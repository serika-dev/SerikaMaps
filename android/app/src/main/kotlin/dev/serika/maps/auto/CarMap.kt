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
import dev.serika.maps.SerikaMapsApp
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.PI
import kotlin.math.atan
import kotlin.math.ln
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sinh

/**
 * Pannable street map drawn on the Android Auto surface.
 * OpenStreetMap tiles are used because the previous Carto host now returns
 * an "API key required" watermark instead of a map.
 */
object CarMap {

    private const val TILE = 256
    private const val MIN_ZOOM = 3.0
    private const val MAX_ZOOM = 18.0
    private val background = Color.parseColor("#d7dce3")
    private val executor = Executors.newSingleThreadExecutor()
    private val drawing = AtomicBoolean(false)
    private val dirty = AtomicBoolean(false)
    private val tiles = object : LinkedHashMap<String, Bitmap>(160, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Bitmap>) = size > 160
    }
    private val traffic = object : LinkedHashMap<String, Bitmap>(160, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Bitmap>) = size > 160
    }
    private val trafficMissUntil = HashMap<String, Long>()

    @Volatile private var surface: Surface? = null
    @Volatile private var width = 0
    @Volatile private var height = 0
    @Volatile private var visible = Rect()
    @Volatile private var zoom = 13.0
    @Volatile private var cameraLat = 52.37
    @Volatile private var cameraLon = 4.89
    @Volatile private var userLat = 52.37
    @Volatile private var userLon = 4.89
    @Volatile private var hasUser = false
    @Volatile private var follow = true
    @Volatile private var route: List<List<Double>> = emptyList()
    @Volatile private var destLat = Double.NaN
    @Volatile private var destLon = Double.NaN

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

            override fun onScroll(distanceX: Float, distanceY: Float) {
                pan(distanceX, distanceY)
            }

            override fun onFling(velocityX: Float, velocityY: Float) {
                pan(velocityX * 0.18f, velocityY * 0.18f)
            }

            override fun onScale(focusX: Float, focusY: Float, scaleFactor: Float) {
                if (scaleFactor.isFinite() && scaleFactor > 0f) {
                    zoomBy(ln(scaleFactor.toDouble()) / ln(2.0))
                }
            }
        })
    }

    fun showLocation(latitude: Double, longitude: Double) {
        userLat = latitude
        userLon = longitude
        hasUser = true
        if (follow) {
            cameraLat = latitude
            cameraLon = longitude
        }
        redraw()
    }

    fun setRoute(line: List<List<Double>>, latitude: Double, longitude: Double) {
        route = line
        destLat = latitude
        destLon = longitude
        follow = false
        fit(line.mapNotNull { pair ->
            if (pair.size >= 2) pair[1] to pair[0] else null
        } + if (hasUser) listOf(userLat to userLon) else emptyList())
        redraw()
    }

    fun clearRoute() {
        route = emptyList()
        destLat = Double.NaN
        destLon = Double.NaN
        redraw()
    }

    fun pan(dx: Float, dy: Float) {
        follow = false
        val z = zoom.toInt().coerceIn(MIN_ZOOM.toInt(), MAX_ZOOM.toInt())
        val scale = 2.0.pow(zoom - z)
        val world = project(cameraLat, cameraLon, z)
        val next = unproject(world.first - dx / scale, world.second - dy / scale, z)
        cameraLat = next.first.coerceIn(-85.0, 85.0)
        cameraLon = normalizeLon(next.second)
        redraw()
    }

    fun zoomBy(steps: Int) {
        zoomBy(steps.toDouble())
    }

    fun recenter() {
        if (!hasUser) return
        follow = true
        cameraLat = userLat
        cameraLon = userLon
        zoom = 15.0
        redraw()
    }

    private fun zoomBy(steps: Double) {
        zoom = (zoom + steps).coerceIn(MIN_ZOOM, MAX_ZOOM)
        redraw()
    }

    private fun fit(points: List<Pair<Double, Double>>) {
        if (points.isEmpty()) return
        var minLat = 90.0
        var maxLat = -90.0
        var minLon = 180.0
        var maxLon = -180.0
        for ((lat, lon) in points) {
            minLat = minOf(minLat, lat)
            maxLat = maxOf(maxLat, lat)
            minLon = minOf(minLon, lon)
            maxLon = maxOf(maxLon, lon)
        }
        cameraLat = (minLat + maxLat) / 2
        cameraLon = (minLon + maxLon) / 2
        val area = anchorSize()
        var chosen = 15.0
        for (candidate in 17 downTo 4) {
            val a = project(maxLat, minLon, candidate)
            val b = project(minLat, maxLon, candidate)
            val spanX = kotlin.math.abs(b.first - a.first)
            val spanY = kotlin.math.abs(b.second - a.second)
            if (spanX < area.first * 0.72 && spanY < area.second * 0.62) {
                chosen = candidate.toDouble()
                break
            }
        }
        zoom = chosen
    }

    private fun redraw() {
        if (!drawing.compareAndSet(false, true)) {
            dirty.set(true)
            return
        }
        executor.execute {
            try {
                do {
                    dirty.set(false)
                    val frame = capture()
                    if (frame.surface == null || frame.width <= 0 || frame.height <= 0) break
                    paint(frame, loadTiles(frame, fetchMissing = false), loadTraffic(frame))
                    val missing = missingTiles(frame)
                    val missingTraffic = missingTraffic(frame)
                    if (missing.isNotEmpty() || missingTraffic.isNotEmpty()) {
                        missing.take(16).forEach { key -> fetchTile(key)?.let { synchronized(tiles) { tiles[key] = it } } }
                        missingTraffic.take(12).forEach { key ->
                            fetchTraffic(key)?.let { synchronized(traffic) { traffic[key] = it } }
                        }
                        paint(frame, loadTiles(frame, fetchMissing = false), loadTraffic(frame))
                    }
                } while (dirty.get())
            } finally {
                drawing.set(false)
                if (dirty.compareAndSet(true, false)) redraw()
            }
        }
    }

    private fun capture(): Frame {
        return Frame(
            surface, width, height, Rect(visible), zoom, cameraLat, cameraLon,
            userLat, userLon, hasUser, route.toList(), destLat, destLon,
        )
    }

    private fun missingTiles(frame: Frame): List<String> {
        return tileKeys(frame).filter { key -> synchronized(tiles) { tiles[key] } == null }
    }

    private fun missingTraffic(frame: Frame): List<String> {
        val now = System.currentTimeMillis()
        return tileKeys(frame).filter { key ->
            synchronized(traffic) { traffic[key] } == null && (trafficMissUntil[key] ?: 0L) <= now
        }
    }

    private fun loadTraffic(frame: Frame): Map<String, Bitmap> {
        val found = HashMap<String, Bitmap>()
        for (key in tileKeys(frame)) {
            val cached = synchronized(traffic) { traffic[key] }
            if (cached != null) found[key] = cached
        }
        return found
    }

    private fun loadTiles(frame: Frame, fetchMissing: Boolean): Map<String, Bitmap> {
        val found = HashMap<String, Bitmap>()
        for (key in tileKeys(frame)) {
            val cached = synchronized(tiles) { tiles[key] }
            val bitmap = cached ?: if (fetchMissing) fetchTile(key)?.also { synchronized(tiles) { tiles[key] = it } } else null
            if (bitmap != null) found[key] = bitmap
        }
        return found
    }

    private fun tileKeys(frame: Frame): List<String> {
        val z = frame.zoom.toInt().coerceIn(MIN_ZOOM.toInt(), MAX_ZOOM.toInt())
        val origin = origin(frame, z)
        val n = 1 shl z
        val scale = 2.0.pow(frame.zoom - z)
        val spanX = frame.width / scale
        val spanY = frame.height / scale
        val x0 = kotlin.math.floor(origin.first / TILE).toInt() - 1
        val y0 = kotlin.math.floor(origin.second / TILE).toInt() - 1
        val x1 = kotlin.math.floor((origin.first + spanX) / TILE).toInt() + 1
        val y1 = kotlin.math.floor((origin.second + spanY) / TILE).toInt() + 1
        val keys = ArrayList<String>()
        for (x in x0..x1) {
            for (y in y0..y1) {
                if (y < 0 || y >= n) continue
                keys.add("$z/${Math.floorMod(x, n)}/$y")
            }
        }
        return keys
    }

    private fun paint(frame: Frame, bitmaps: Map<String, Bitmap>, trafficBitmaps: Map<String, Bitmap>) {
        val current = frame.surface ?: return
        if (!current.isValid) return
        val canvas = try {
            current.lockCanvas(null)
        } catch (_: Exception) {
            null
        } ?: return
        try {
            canvas.drawColor(background)
            val z = frame.zoom.toInt().coerceIn(MIN_ZOOM.toInt(), MAX_ZOOM.toInt())
            val scale = 2.0.pow(frame.zoom - z).toFloat()
            val anchor = anchor(frame)
            val origin = origin(frame, z)
            canvas.save()
            canvas.translate(anchor.first, anchor.second)
            canvas.scale(scale, scale)
            canvas.translate(-anchor.first, -anchor.second)
            val n = 1 shl z
            bitmaps.forEach { (key, bitmap) ->
                val parts = key.split("/")
                if (parts[0].toInt() != z) return@forEach
                val x = parts[1].toInt()
                val y = parts[2].toInt()
                var worldX = x * TILE.toDouble()
                while (worldX < origin.first - TILE) worldX += n * TILE
                canvas.drawBitmap(bitmap, (worldX - origin.first).toFloat(), (y * TILE - origin.second).toFloat(), null)
            }
            trafficBitmaps.forEach { (key, bitmap) ->
                val parts = key.split("/")
                if (parts[0].toInt() != z) return@forEach
                val x = parts[1].toInt()
                val y = parts[2].toInt()
                var worldX = x * TILE.toDouble()
                while (worldX < origin.first - TILE) worldX += n * TILE
                canvas.drawBitmap(bitmap, (worldX - origin.first).toFloat(), (y * TILE - origin.second).toFloat(), null)
            }
            drawRoute(canvas, frame, origin, z)
            canvas.restore()
            drawMarker(canvas, frame, frame.userLat, frame.userLon, Color.parseColor("#8b5cf6"), frame.hasUser, z, origin, scale, anchor)
            if (!frame.destLat.isNaN()) {
                drawMarker(canvas, frame, frame.destLat, frame.destLon, Color.parseColor("#e11d48"), true, z, origin, scale, anchor)
            }
            val label = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.WHITE
                textSize = 22f
                setShadowLayer(4f, 0f, 1f, Color.BLACK)
            }
            val area = if (frame.visible.height() > 0) frame.visible else Rect(0, 0, frame.width, frame.height)
            canvas.drawText("© OpenStreetMap  © TomTom", area.left + 16f, area.bottom - 18f, label)
        } catch (_: Exception) {
        } finally {
            try {
                current.unlockCanvasAndPost(canvas)
            } catch (_: Exception) {
            }
        }
    }

    private fun drawRoute(canvas: Canvas, frame: Frame, origin: Pair<Double, Double>, z: Int) {
        val points = frame.route
        if (points.size < 2) return
        val path = Path()
        var started = false
        val step = if (points.size > 700) points.size / 700 else 1
        var index = 0
        while (index < points.size) {
            val pair = points[index]
            if (pair.size >= 2) {
                val world = project(pair[1], pair[0], z)
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
            strokeWidth = 12f
            color = Color.parseColor("#5b21b6")
        }
        canvas.drawPath(path, stroke)
        stroke.color = Color.parseColor("#c4b5fd")
        stroke.strokeWidth = 6f
        canvas.drawPath(path, stroke)
    }

    private fun drawMarker(
        canvas: Canvas,
        frame: Frame,
        lat: Double,
        lon: Double,
        color: Int,
        show: Boolean,
        z: Int,
        origin: Pair<Double, Double>,
        scale: Float,
        anchor: Pair<Float, Float>,
    ) {
        if (!show) return
        val world = project(lat, lon, z)
        val x = anchor.first + ((world.first - origin.first).toFloat() - anchor.first) * scale
        val y = anchor.second + ((world.second - origin.second).toFloat() - anchor.second) * scale
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        paint.color = Color.WHITE
        canvas.drawCircle(x, y, 16f, paint)
        paint.color = color
        canvas.drawCircle(x, y, 10f, paint)
    }

    private fun origin(frame: Frame, z: Int): Pair<Double, Double> {
        val world = project(frame.cameraLat, frame.cameraLon, z)
        val anchor = anchor(frame)
        return (world.first - anchor.first) to (world.second - anchor.second)
    }

    private fun anchor(frame: Frame): Pair<Float, Float> {
        val area = frame.visible
        val x = if (area.width() > 40) area.centerX().toFloat() else frame.width / 2f
        val y = if (area.height() > 40) area.centerY().toFloat() else frame.height / 2f
        return x to y
    }

    private fun anchorSize(): Pair<Float, Float> {
        val area = visible
        val w = if (area.width() > 40) area.width().toFloat() else width.toFloat()
        val h = if (area.height() > 40) area.height().toFloat() else height.toFloat()
        return w.coerceAtLeast(200f) to h.coerceAtLeast(200f)
    }

    private fun project(latitude: Double, longitude: Double, z: Int): Pair<Double, Double> {
        val n = (1 shl z).toDouble()
        val x = (longitude + 180.0) / 360.0 * n * TILE
        val sine = sin(latitude * PI / 180.0).coerceIn(-0.9999, 0.9999)
        val y = (0.5 - ln((1 + sine) / (1 - sine)) / (4 * PI)) * n * TILE
        return x to y
    }

    private fun unproject(x: Double, y: Double, z: Int): Pair<Double, Double> {
        val n = (1 shl z).toDouble() * TILE
        val lon = x / n * 360.0 - 180.0
        val mercator = PI * (1 - 2 * y / n)
        val lat = atan(sinh(mercator)) * 180.0 / PI
        return lat to lon
    }

    private fun normalizeLon(longitude: Double): Double {
        var value = longitude
        while (value < -180) value += 360
        while (value > 180) value -= 360
        return value
    }

    private fun fetchTraffic(key: String): Bitmap? {
        if ((trafficMissUntil[key] ?: 0L) > System.currentTimeMillis()) return null
        return try {
            val connection = URL("${SerikaMapsApp.API_BASE_URL}/api/traffic/flow/$key?theme=light")
                .openConnection() as HttpURLConnection
            connection.setRequestProperty("User-Agent", "SerikaMaps-Android/1.0 (https://maps.serika.dev)")
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 8_000
            connection.readTimeout = 8_000
            if (connection.responseCode != 200) {
                noteTrafficMiss(key)
                return null
            }
            connection.inputStream.use { BitmapFactory.decodeStream(it) }?.also {
                trafficMissUntil.remove(key)
            } ?: run {
                noteTrafficMiss(key)
                null
            }
        } catch (_: Exception) {
            noteTrafficMiss(key)
            null
        }
    }

    private fun noteTrafficMiss(key: String) {
        trafficMissUntil[key] = System.currentTimeMillis() + 20_000
        if (trafficMissUntil.size > 300) trafficMissUntil.clear()
    }

    private fun fetchTile(key: String): Bitmap? {
        return try {
            val connection = URL("https://tile.openstreetmap.org/$key.png").openConnection() as HttpURLConnection
            connection.setRequestProperty("User-Agent", "SerikaMaps-Android/1.0 (https://maps.serika.dev)")
            connection.connectTimeout = 8_000
            connection.readTimeout = 8_000
            connection.inputStream.use { BitmapFactory.decodeStream(it) }
        } catch (_: Exception) {
            null
        }
    }

    private data class Frame(
        val surface: Surface?,
        val width: Int,
        val height: Int,
        val visible: Rect,
        val zoom: Double,
        val cameraLat: Double,
        val cameraLon: Double,
        val userLat: Double,
        val userLon: Double,
        val hasUser: Boolean,
        val route: List<List<Double>>,
        val destLat: Double,
        val destLon: Double,
    )
}
