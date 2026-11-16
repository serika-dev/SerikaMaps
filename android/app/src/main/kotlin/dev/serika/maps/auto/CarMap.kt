package dev.serika.maps.auto

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Rect
import android.view.Surface
import androidx.car.app.AppManager
import androidx.car.app.CarContext
import androidx.car.app.SurfaceCallback
import androidx.car.app.SurfaceContainer
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import kotlin.math.PI
import kotlin.math.ln
import kotlin.math.sin

/**
 * Draws the navigation map onto the Android Auto surface. The host leaves
 * that surface black unless the app paints it.
 */
object CarMap {

    private const val ZOOM = 15
    private const val TILE = 256
    private val background = Color.parseColor("#12101c")
    private val executor = Executors.newSingleThreadExecutor()
    private val tiles = object : LinkedHashMap<String, Bitmap>(48, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Bitmap>) = size > 48
    }

    @Volatile private var surface: Surface? = null
    @Volatile private var width = 0
    @Volatile private var height = 0
    @Volatile private var visible = Rect()
    @Volatile private var lat = 52.37
    @Volatile private var lon = 4.89
    @Volatile private var route: List<List<Double>> = emptyList()
    private var placed = false

    fun attach(carContext: CarContext) {
        carContext.getCarService(AppManager::class.java).setSurfaceCallback(object : SurfaceCallback {
            override fun onSurfaceAvailable(container: SurfaceContainer) {
                surface = container.surface
                width = container.width
                height = container.height
                redraw()
            }

            override fun onSurfaceDestroyed(container: SurfaceContainer) {
                surface = null
            }

            override fun onVisibleAreaChanged(visibleArea: Rect) {
                visible = Rect(visibleArea)
                redraw()
            }
        })
    }

    fun setView(latitude: Double, longitude: Double, line: List<List<Double>>) {
        lat = latitude
        lon = longitude
        route = line
        placed = true
        redraw()
    }

    private fun redraw() {
        executor.execute {
            val snapshot = Snapshot(surface, width, height, Rect(visible), lat, lon, route, placed)
            if (snapshot.surface == null || snapshot.width <= 0 || snapshot.height <= 0) return@execute
            val bitmaps = loadTiles(snapshot)
            paint(snapshot, bitmaps)
        }
    }

    private fun loadTiles(snapshot: Snapshot): Map<String, Bitmap> {
        val origin = origin(snapshot)
        val n = 1 shl ZOOM
        val found = HashMap<String, Bitmap>()
        val x0 = kotlin.math.floor(origin.first / TILE).toInt()
        val y0 = kotlin.math.floor(origin.second / TILE).toInt()
        val x1 = kotlin.math.floor((origin.first + snapshot.width) / TILE).toInt()
        val y1 = kotlin.math.floor((origin.second + snapshot.height) / TILE).toInt()
        for (x in x0..x1) {
            for (y in y0..y1) {
                if (y < 0 || y >= n) continue
                val wrapped = Math.floorMod(x, n)
                val key = "$ZOOM/$wrapped/$y"
                val cached = synchronized(tiles) { tiles[key] }
                val bitmap = cached ?: fetchTile(key)?.also { synchronized(tiles) { tiles[key] = it } }
                if (bitmap != null) found[key] = bitmap
            }
        }
        return found
    }

    private fun paint(snapshot: Snapshot, bitmaps: Map<String, Bitmap>) {
        val current = snapshot.surface ?: return
        if (!current.isValid) return
        val canvas = try {
            current.lockCanvas(null)
        } catch (_: Exception) {
            null
        } ?: return
        try {
            canvas.drawColor(background)
            val origin = origin(snapshot)
            val n = 1 shl ZOOM
            bitmaps.forEach { (key, bitmap) ->
                val parts = key.split("/")
                val x = parts[1].toInt()
                val y = parts[2].toInt()
                var worldX = x * TILE
                while (worldX < origin.first - TILE) worldX += n * TILE
                val left = (worldX - origin.first).toFloat()
                val top = (y * TILE - origin.second).toFloat()
                canvas.drawBitmap(bitmap, left, top, null)
            }
            drawRoute(canvas, snapshot, origin)
            val anchor = anchor(snapshot)
            val dot = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
            canvas.drawCircle(anchor.first, anchor.second, 14f, dot)
            dot.color = Color.parseColor("#8b5cf6")
            canvas.drawCircle(anchor.first, anchor.second, 9f, dot)
        } catch (_: Exception) {
        } finally {
            try {
                current.unlockCanvasAndPost(canvas)
            } catch (_: Exception) {
            }
        }
    }

    private fun drawRoute(canvas: Canvas, snapshot: Snapshot, origin: Pair<Double, Double>) {
        val points = snapshot.route
        if (points.size < 2) return
        val path = Path()
        var started = false
        val step = if (points.size > 900) points.size / 900 else 1
        var index = 0
        while (index < points.size) {
            val pair = points[index]
            if (pair.size >= 2) {
                val world = project(pair[1], pair[0])
                val x = (world.first - origin.first).toFloat()
                val y = (world.second - origin.second).toFloat()
                if (!started) {
                    path.moveTo(x, y)
                    started = true
                } else {
                    path.lineTo(x, y)
                }
            }
            index += step
        }
        val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
            strokeWidth = 14f
            color = Color.parseColor("#4c1d95")
        }
        canvas.drawPath(path, stroke)
        stroke.color = Color.parseColor("#c4b5fd")
        stroke.strokeWidth = 7f
        canvas.drawPath(path, stroke)
    }

    private fun origin(snapshot: Snapshot): Pair<Double, Double> {
        val world = project(snapshot.lat, snapshot.lon)
        val anchor = anchor(snapshot)
        return (world.first - anchor.first) to (world.second - anchor.second)
    }

    private fun anchor(snapshot: Snapshot): Pair<Float, Float> {
        val area = snapshot.visible
        val x = if (area.width() > 0) area.centerX().toFloat() else snapshot.width / 2f
        val y = if (area.height() > 0) area.centerY().toFloat() else snapshot.height / 2f
        return x to y
    }

    private fun project(latitude: Double, longitude: Double): Pair<Double, Double> {
        val n = (1 shl ZOOM).toDouble()
        val x = (longitude + 180.0) / 360.0 * n * TILE
        val sine = sin(latitude * PI / 180.0).coerceIn(-0.9999, 0.9999)
        val y = (0.5 - ln((1 + sine) / (1 - sine)) / (4 * PI)) * n * TILE
        return x to y
    }

    private fun fetchTile(key: String): Bitmap? {
        return try {
            val connection = URL("https://basemaps.cartocdn.com/dark_all/$key.png").openConnection() as HttpURLConnection
            connection.setRequestProperty("User-Agent", "SerikaMaps-Android/1.0 (https://maps.serika.dev)")
            connection.connectTimeout = 8_000
            connection.readTimeout = 8_000
            connection.inputStream.use { BitmapFactory.decodeStream(it) }
        } catch (_: Exception) {
            null
        }
    }

    private data class Snapshot(
        val surface: Surface?,
        val width: Int,
        val height: Int,
        val visible: Rect,
        val lat: Double,
        val lon: Double,
        val route: List<List<Double>>,
        val placed: Boolean,
    )
}
