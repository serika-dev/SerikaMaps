package dev.serika.maps.auto

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
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
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.PI
import kotlin.math.atan
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.ln
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sinh
import kotlin.math.sqrt

/**
 * Pannable street map drawn on the Android Auto surface.
 * Tiles are OpenStreetMap, graded to the Serika night palette. Carto's raster
 * host now returns an API-key watermark instead of the dark style.
 */
object CarMap {

    private const val TILE = 256
    private const val MIN_ZOOM = 3.0
    private const val MAX_ZOOM = 18.0
    private const val BROWSE_ZOOM = 15.0
    private const val NAV_ZOOM = 17.0
    private val background = Color.parseColor("#12101c")
    private val nightPaint = Paint(Paint.FILTER_BITMAP_FLAG).apply {
        val invert = ColorMatrix(floatArrayOf(
            -1f, 0f, 0f, 0f, 255f,
            0f, -1f, 0f, 0f, 255f,
            0f, 0f, -1f, 0f, 255f,
            0f, 0f, 0f, 1f, 0f,
        ))
        val hue = ColorMatrix(floatArrayOf(
            -0.574f, 1.430f, 0.144f, 0f, 0f,
            0.426f, 0.430f, 0.144f, 0f, 0f,
            0.426f, 1.430f, -0.856f, 0f, 0f,
            0f, 0f, 0f, 1f, 0f,
        ))
        val tone = ColorMatrix(floatArrayOf(
            0.78f, 0.04f, 0.10f, 0f, 10f,
            0.02f, 0.74f, 0.08f, 0f, 8f,
            0.10f, 0.06f, 0.92f, 0f, 18f,
            0f, 0f, 0f, 1f, 0f,
        ))
        invert.postConcat(hue)
        invert.postConcat(tone)
        colorFilter = ColorMatrixColorFilter(invert)
    }
    private val executor = Executors.newSingleThreadExecutor()
    private val tilePool = Executors.newFixedThreadPool(4)
    private val inflight: MutableSet<String> = ConcurrentHashMap.newKeySet()
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
    @Volatile private var zoom = BROWSE_ZOOM
    @Volatile private var cameraLat = 52.37
    @Volatile private var cameraLon = 4.89
    @Volatile private var userLat = 52.37
    @Volatile private var userLon = 4.89
    @Volatile private var hasUser = false
    @Volatile private var follow = true
    @Volatile private var bearing = 0.0
    @Volatile private var navigating = false
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
        if (follow) placeCamera()
        redraw()
    }

    fun setRoute(line: List<List<Double>>, latitude: Double, longitude: Double) {
        route = line
        destLat = latitude
        destLon = longitude
        follow = true
        zoom = NAV_ZOOM
        placeCamera()
        redraw()
    }

    fun clearRoute() {
        route = emptyList()
        destLat = Double.NaN
        destLon = Double.NaN
        navigating = false
        bearing = 0.0
        if (follow) {
            zoom = BROWSE_ZOOM
            if (hasUser) {
                cameraLat = userLat
                cameraLon = userLon
            }
        }
        redraw()
    }

    fun pan(dx: Float, dy: Float) {
        val rad = if (navigating) bearing * PI / 180.0 else 0.0
        val worldDx = dx * cos(rad) - dy * sin(rad)
        val worldDy = dx * sin(rad) + dy * cos(rad)
        follow = false
        navigating = false
        bearing = 0.0
        val z = zoom.toInt().coerceIn(MIN_ZOOM.toInt(), MAX_ZOOM.toInt())
        val scale = 2.0.pow(zoom - z)
        val world = project(cameraLat, cameraLon, z)
        val next = unproject(world.first - worldDx / scale, world.second - worldDy / scale, z)
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
        zoom = if (route.size >= 2) NAV_ZOOM else BROWSE_ZOOM
        placeCamera()
        redraw()
    }

    private fun placeCamera() {
        val lat = if (hasUser) userLat else route.firstOrNull()?.getOrNull(1) ?: return
        val lon = if (hasUser) userLon else route.firstOrNull()?.getOrNull(0) ?: return
        cameraLat = lat
        cameraLon = lon
        if (follow && route.size >= 2) {
            navigating = true
            val ahead = pointAhead(lat, lon, 60.0)
            if (haversine(lat, lon, ahead.first, ahead.second) > 8.0) {
                bearing = bearingDegrees(lat, lon, ahead.first, ahead.second)
            }
        } else {
            navigating = false
            bearing = 0.0
        }
    }

    private fun bearingDegrees(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val p1 = lat1 * PI / 180.0
        val p2 = lat2 * PI / 180.0
        val dLon = (lon2 - lon1) * PI / 180.0
        val y = sin(dLon) * cos(p2)
        val x = cos(p1) * sin(p2) - sin(p1) * cos(p2) * cos(dLon)
        return (atan2(y, x) * 180.0 / PI + 360.0) % 360.0
    }

    private fun pointAhead(lat: Double, lon: Double, meters: Double): Pair<Double, Double> {
        val points = route
        if (points.size < 2 || meters <= 0.0) return lat to lon
        var best = 0
        var bestD = Double.MAX_VALUE
        for (i in points.indices) {
            val point = points[i]
            if (point.size < 2) continue
            val dLat = point[1] - lat
            val dLon = point[0] - lon
            val score = dLat * dLat + dLon * dLon
            if (score < bestD) {
                bestD = score
                best = i
            }
        }
        var walked = 0.0
        var prevLat = points[best].getOrNull(1) ?: lat
        var prevLon = points[best].getOrNull(0) ?: lon
        var index = best + 1
        while (index < points.size) {
            val point = points[index]
            if (point.size < 2) {
                index += 1
                continue
            }
            val step = haversine(prevLat, prevLon, point[1], point[0])
            if (walked + step >= meters) {
                val t = if (step <= 0.0) 1.0 else ((meters - walked) / step).coerceIn(0.0, 1.0)
                return (prevLat + (point[1] - prevLat) * t) to normalizeLon(prevLon + (point[0] - prevLon) * t)
            }
            walked += step
            prevLat = point[1]
            prevLon = point[0]
            index += 1
        }
        return prevLat to normalizeLon(prevLon)
    }

    private fun haversine(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val dLat = (lat2 - lat1) * PI / 180.0
        val dLon = (lon2 - lon1) * PI / 180.0
        val a = sin(dLat / 2).pow(2) + cos(lat1 * PI / 180.0) * cos(lat2 * PI / 180.0) * sin(dLon / 2).pow(2)
        return 6371000.0 * 2 * atan2(sqrt(a), sqrt(1 - a))
    }

    private fun zoomBy(steps: Double) {
        zoom = (zoom + steps).coerceIn(MIN_ZOOM, MAX_ZOOM)
        if (follow) placeCamera()
        redraw()
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
                    paint(frame, loadTiles(frame), loadTraffic(frame))
                    requestTiles(frame)
                } while (dirty.get())
            } finally {
                drawing.set(false)
                if (dirty.compareAndSet(true, false)) redraw()
            }
        }
    }

    private fun requestTiles(frame: Frame) {
        val base = missingTiles(frame)
        for (key in base) {
            if (!inflight.add("osm:$key")) continue
            tilePool.execute {
                try {
                    fetchTile(key)?.let { bitmap -> synchronized(tiles) { tiles[key] = bitmap } }
                } finally {
                    inflight.remove("osm:$key")
                    redraw()
                }
            }
        }
        if (base.isNotEmpty() || inflight.any { it.startsWith("osm:") }) return
        for (key in missingTraffic(frame)) {
            if (!inflight.add("flow:$key")) continue
            tilePool.execute {
                try {
                    fetchTraffic(key)?.let { bitmap -> synchronized(traffic) { traffic[key] = bitmap } }
                } finally {
                    inflight.remove("flow:$key")
                    redraw()
                }
            }
        }
    }

    private fun capture(): Frame {
        return Frame(
            surface, width, height, Rect(visible), zoom, cameraLat, cameraLon,
            userLat, userLon, hasUser, route.toList(), destLat, destLon,
            bearing, navigating,
        )
    }

    private fun missingTiles(frame: Frame): List<String> {
        return tileKeys(frame).filter { key -> synchronized(tiles) { tiles[key] } == null }
    }

    private fun missingTraffic(frame: Frame): List<String> {
        val now = System.currentTimeMillis()
        return tileKeys(frame).filter { key ->
            val cached = synchronized(traffic) { traffic[key] }
            val cooling = synchronized(trafficMissUntil) { (trafficMissUntil[key] ?: 0L) > now }
            cached == null && !cooling
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

    private fun loadTiles(frame: Frame): Map<String, Bitmap> {
        val found = HashMap<String, Bitmap>()
        for (key in tileKeys(frame)) {
            val cached = synchronized(tiles) { tiles[key] }
            if (cached != null) found[key] = cached
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
        val pad = if (frame.navigating) 2 else 1
        val x0 = kotlin.math.floor(origin.first / TILE).toInt() - pad
        val y0 = kotlin.math.floor(origin.second / TILE).toInt() - pad
        val x1 = kotlin.math.floor((origin.first + spanX) / TILE).toInt() + pad
        val y1 = kotlin.math.floor((origin.second + spanY) / TILE).toInt() + pad
        val keys = ArrayList<String>()
        for (x in x0..x1) {
            for (y in y0..y1) {
                if (y < 0 || y >= n) continue
                keys.add("$z/${Math.floorMod(x, n)}/$y")
            }
        }
        val midX = (x0 + x1) / 2.0
        val midY = (y0 + y1) / 2.0
        keys.sortBy { key ->
            val parts = key.split("/")
            val dx = parts[1].toDouble() - midX
            val dy = parts[2].toDouble() - midY
            dx * dx + dy * dy
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
            if (frame.navigating) canvas.rotate(-frame.bearing.toFloat())
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
                canvas.drawBitmap(bitmap, (worldX - origin.first).toFloat(), (y * TILE - origin.second).toFloat(), nightPaint)
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
            drawMarker(canvas, frame, frame.userLat, frame.userLon, Color.parseColor("#8b5cf6"), frame.hasUser, true, z, origin, scale, anchor)
            if (!frame.destLat.isNaN()) {
                drawMarker(canvas, frame, frame.destLat, frame.destLon, Color.parseColor("#e11d48"), true, false, z, origin, scale, anchor)
            }
        } catch (_: Exception) {
        } finally {
            try {
                current.unlockCanvasAndPost(canvas)
            } catch (_: Exception) {
            }
        }
    }

    private fun drawRoute(canvas: Canvas, frame: Frame, origin: Pair<Double, Double>, z: Int) {
        val points = remainingRoute(frame)
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
        val wide = if (frame.navigating) 16f else 12f
        val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
            strokeWidth = wide
            color = Color.parseColor("#5b21b6")
        }
        canvas.drawPath(path, stroke)
        stroke.color = Color.parseColor("#c4b5fd")
        stroke.strokeWidth = wide * 0.5f
        canvas.drawPath(path, stroke)
    }

    private fun remainingRoute(frame: Frame): List<List<Double>> {
        val points = frame.route
        if (points.size < 2 || !frame.hasUser) return points
        var best = 0
        var bestD = Double.MAX_VALUE
        for (i in points.indices) {
            val point = points[i]
            if (point.size < 2) continue
            val dLat = point[1] - frame.userLat
            val dLon = point[0] - frame.userLon
            val score = dLat * dLat + dLon * dLon
            if (score < bestD) {
                bestD = score
                best = i
            }
        }
        val start = (best - 1).coerceAtLeast(0)
        return points.subList(start, points.size)
    }

    private fun drawMarker(
        canvas: Canvas,
        frame: Frame,
        lat: Double,
        lon: Double,
        color: Int,
        show: Boolean,
        chevron: Boolean,
        z: Int,
        origin: Pair<Double, Double>,
        scale: Float,
        anchor: Pair<Float, Float>,
    ) {
        if (!show) return
        val (x, y) = screenPoint(frame, lat, lon, z, origin, scale, anchor)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        if (chevron && frame.navigating) {
            val outer = Path()
            outer.moveTo(x, y - 28f)
            outer.lineTo(x - 16f, y + 18f)
            outer.lineTo(x, y + 8f)
            outer.lineTo(x + 16f, y + 18f)
            outer.close()
            paint.style = Paint.Style.FILL
            paint.color = Color.WHITE
            canvas.drawPath(outer, paint)
            val inner = Path()
            inner.moveTo(x, y - 20f)
            inner.lineTo(x - 10f, y + 14f)
            inner.lineTo(x, y + 6f)
            inner.lineTo(x + 10f, y + 14f)
            inner.close()
            paint.color = color
            canvas.drawPath(inner, paint)
            return
        }
        paint.color = Color.WHITE
        canvas.drawCircle(x, y, 16f, paint)
        paint.color = color
        canvas.drawCircle(x, y, 10f, paint)
    }

    private fun screenPoint(
        frame: Frame,
        lat: Double,
        lon: Double,
        z: Int,
        origin: Pair<Double, Double>,
        scale: Float,
        anchor: Pair<Float, Float>,
    ): Pair<Float, Float> {
        val world = project(lat, lon, z)
        var dx = (world.first - origin.first - anchor.first).toFloat()
        var dy = (world.second - origin.second - anchor.second).toFloat()
        if (frame.navigating) {
            val rad = Math.toRadians(-frame.bearing)
            val cosB = cos(rad).toFloat()
            val sinB = sin(rad).toFloat()
            val rx = dx * cosB - dy * sinB
            val ry = dx * sinB + dy * cosB
            dx = rx
            dy = ry
        }
        return (anchor.first + dx * scale) to (anchor.second + dy * scale)
    }

    private fun origin(frame: Frame, z: Int): Pair<Double, Double> {
        val world = project(frame.cameraLat, frame.cameraLon, z)
        val anchor = anchor(frame)
        return (world.first - anchor.first) to (world.second - anchor.second)
    }

    private fun anchor(frame: Frame): Pair<Float, Float> {
        val area = frame.visible
        val x = if (area.width() > 40) area.exactCenterX() else frame.width / 2f
        val top = if (area.height() > 40) area.top.toFloat() else 0f
        val h = if (area.height() > 40) area.height().toFloat() else frame.height.toFloat()
        val y = if (frame.navigating) top + h * 0.72f else top + h * 0.5f
        return x to y
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
        val now = System.currentTimeMillis()
        synchronized(trafficMissUntil) {
            if ((trafficMissUntil[key] ?: 0L) > now) return null
        }
        return try {
            val connection = URL("${SerikaMapsApp.API_BASE_URL}/api/traffic/flow/$key?theme=light")
                .openConnection() as HttpURLConnection
            connection.setRequestProperty("User-Agent", "SerikaMaps-Android/1.0 (https://maps.serika.dev)")
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 5_000
            connection.readTimeout = 5_000
            if (connection.responseCode != 200) {
                noteTrafficMiss(key)
                return null
            }
            connection.inputStream.use { BitmapFactory.decodeStream(it) }?.also {
                synchronized(trafficMissUntil) { trafficMissUntil.remove(key) }
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
        synchronized(trafficMissUntil) {
            trafficMissUntil[key] = System.currentTimeMillis() + 20_000
            if (trafficMissUntil.size > 300) trafficMissUntil.clear()
        }
    }

    private fun fetchTile(key: String): Bitmap? {
        return try {
            val connection = URL("https://tile.openstreetmap.org/$key.png").openConnection() as HttpURLConnection
            connection.setRequestProperty("User-Agent", "SerikaMaps-Android/1.0 (https://maps.serika.dev)")
            connection.connectTimeout = 5_000
            connection.readTimeout = 5_000
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
        val bearing: Double,
        val navigating: Boolean,
    )
}
