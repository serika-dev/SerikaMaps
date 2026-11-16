package dev.serika.maps.auto

import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.media.AudioAttributes
import android.os.Bundle
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.util.Log
import androidx.car.app.CarContext
import androidx.car.app.CarToast
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.ActionStrip
import androidx.car.app.model.CarIcon
import androidx.car.app.model.DateTimeWithZone
import androidx.car.app.model.Distance
import androidx.car.app.model.Template
import androidx.car.app.navigation.model.Maneuver
import androidx.car.app.navigation.model.NavigationTemplate
import androidx.car.app.navigation.model.RoutingInfo
import androidx.car.app.navigation.model.Step
import androidx.car.app.navigation.model.TravelEstimate
import androidx.core.graphics.drawable.IconCompat
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import dev.serika.maps.R
import dev.serika.maps.data.ApiClient
import dev.serika.maps.data.models.Maneuver as RouteManeuver
import dev.serika.maps.data.models.NavigationRoute
import dev.serika.maps.data.models.SearchResult
import java.time.Duration
import java.util.Locale
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Map home screen. A route is optional: the surface shows a street map that
 * can be dragged and zoomed before any destination is chosen.
 */
class NavigationScreen(carContext: CarContext) : Screen(carContext) {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val apiClient = ApiClient()
    private var destLat: Double? = null
    private var destLon: Double? = null
    private var route: NavigationRoute? = null
    private var routing = false
    private var error: String? = null
    private var errorShown = false
    private var stepIndex = 0
    private var userLat = Double.NaN
    private var userLon = Double.NaN
    private var hasFix = false
    private var shownMeters = -1.0
    private var farSpoken = -1
    private var nearSpoken = -1
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var pendingSpeech: String? = null

    private val locationListener = object : LocationListener {
        override fun onLocationChanged(location: Location) {
            onFix(location.latitude, location.longitude)
        }

        override fun onProviderEnabled(provider: String) {}

        override fun onProviderDisabled(provider: String) {}

        @Deprecated("Deprecated in Java")
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
    }

    init {
        showHere()
        tts = TextToSpeech(carContext) { status ->
            if (status != TextToSpeech.SUCCESS) return@TextToSpeech
            ttsReady = true
            tts?.language = Locale.US
            tts?.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            pendingSpeech?.let { speak(it) }
        }
        lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onStart(owner: LifecycleOwner) {
                watchLocation(true)
                invalidate()
            }

            override fun onStop(owner: LifecycleOwner) {
                watchLocation(false)
            }

            override fun onDestroy(owner: LifecycleOwner) {
                watchLocation(false)
                scope.cancel()
                tts?.stop()
                tts?.shutdown()
                tts = null
                ttsReady = false
            }
        })
    }

    fun startNavigation(latitude: Double, longitude: Double) {
        destLat = latitude
        destLon = longitude
        route = null
        error = null
        errorShown = false
        routing = true
        resetGuidance()
        loadRoute()
        refresh()
    }

    private fun showHere() {
        scope.launch {
            val location = lastLocation()
            if (location != null) {
                CarMap.showLocation(location.first, location.second)
            } else {
                CarMap.recenter()
            }
        }
    }

    private fun loadRoute() {
        val latitude = destLat ?: return
        val longitude = destLon ?: return
        scope.launch {
            try {
                val location = lastLocation()
                if (location == null) {
                    error = "Location is off, so a route cannot be started"
                    routing = false
                    refresh()
                    return@launch
                }
                CarMap.showLocation(location.first, location.second)
                val loaded = apiClient.getNavigationRoute(
                    originLat = location.first,
                    originLon = location.second,
                    destLat = latitude,
                    destLon = longitude,
                )
                withContext(Dispatchers.Main) {
                    if (loaded.maneuvers.isEmpty()) {
                        error = "No driving route was found"
                        route = null
                    } else {
                        route = loaded
                        beginGuidance(loaded, location.first, location.second)
                        CarMap.setRoute(loaded.geometry?.coordinates.orEmpty(), latitude, longitude)
                    }
                    routing = false
                    refresh()
                }
                return@launch
            } catch (e: Exception) {
                error = "The route could not be loaded"
                Log.e("SerikaMaps", "Failed to load route", e)
            }
            routing = false
            refresh()
        }
    }

    private fun clearRoute() {
        destLat = null
        destLon = null
        route = null
        routing = false
        error = null
        resetGuidance()
        tts?.stop()
        CarMap.clearRoute()
        showHere()
        refresh()
    }

    override fun onGetTemplate(): Template {
        error?.let { message ->
            if (!errorShown) {
                errorShown = true
                CarToast.makeText(carContext, message, CarToast.LENGTH_LONG).show()
            }
        }
        return try {
            buildTemplate()
        } catch (e: Exception) {
            Log.e("SerikaMaps", "Navigation template rejected", e)
            browseTemplate()
        }
    }

    private fun buildTemplate(): Template {
        val builder = NavigationTemplate.Builder()
            .setActionStrip(buildActionStrip())
            .setMapActionStrip(buildMapStrip())
            .setPanModeListener { }

        val currentRoute = route
        if (routing && currentRoute == null) {
            builder.setNavigationInfo(RoutingInfo.Builder().setLoading(true).build())
        } else if (currentRoute != null && currentRoute.maneuvers.isNotEmpty()) {
            val index = stepIndex.coerceIn(0, currentRoute.maneuvers.lastIndex)
            val currentStep = currentRoute.maneuvers[index]
            val nextStep = currentRoute.maneuvers.getOrNull(index + 1)
            val toTurn = if (hasFix) {
                haversine(userLat, userLon, currentStep.location.lat, currentStep.location.lon)
            } else {
                fallbackMeters(currentRoute, index)
            }
            val routingInfo = RoutingInfo.Builder()
                .setCurrentStep(buildStep(currentStep), meters(toTurn))
            if (nextStep != null) routingInfo.setNextStep(buildStep(nextStep))
            val trip = remainingTrip(currentRoute, index, toTurn)
            val fraction = if (currentRoute.totalDistance > 1.0) {
                (trip / currentRoute.totalDistance).coerceIn(0.02, 1.0)
            } else {
                1.0
            }
            val seconds = (currentRoute.totalDuration * fraction).toLong().coerceAtLeast(1)
            builder
                .setNavigationInfo(routingInfo.build())
                .setDestinationTravelEstimate(
                    TravelEstimate.Builder(
                        meters(trip),
                        DateTimeWithZone.create(
                            System.currentTimeMillis() + seconds * 1000,
                            java.util.TimeZone.getDefault()
                        )
                    ).setRemainingTime(Duration.ofSeconds(seconds)).build()
                )
        }
        return builder.build()
    }

    private fun browseTemplate(): Template {
        return NavigationTemplate.Builder()
            .setActionStrip(buildActionStrip())
            .setMapActionStrip(buildMapStrip())
            .setPanModeListener { }
            .build()
    }

    private fun buildStep(step: RouteManeuver): Step {
        val cue = step.instruction.ifBlank { "Continue" }.take(32)
        return Step.Builder(cue)
            .setManeuver(Maneuver.Builder(mapManeuverType(step.type, step.modifier)).build())
            .setRoad(roadLabel(step).take(24))
            .build()
    }

    private fun roadLabel(step: RouteManeuver): String {
        val street = step.streetName.trim()
        if (street.isNotEmpty() && !street.equals("the road", ignoreCase = true)) return street
        val onto = step.instruction.substringAfter(" onto ", "")
        if (onto.isNotBlank() && !onto.equals("the road", ignoreCase = true)) return onto
        return "Current road"
    }

    private fun meters(value: Double): Distance {
        val safe = if (value.isFinite() && value > 0.0) value else 1.0
        return when {
            safe >= 10_000 -> Distance.create(safe / 1000.0, Distance.UNIT_KILOMETERS)
            safe >= 1_000 -> Distance.create(safe / 1000.0, Distance.UNIT_KILOMETERS_P1)
            else -> Distance.create(safe, Distance.UNIT_METERS)
        }
    }

    private fun buildActionStrip(): ActionStrip {
        val strip = ActionStrip.Builder()
        if (route != null || routing) {
            strip.addAction(
                Action.Builder()
                    .setTitle("Stop")
                    .setOnClickListener { clearRoute() }
                    .build()
            )
        } else {
            strip.addAction(
                Action.Builder()
                    .setTitle("Search")
                    .setOnClickListener { openSearch() }
                    .build()
            )
        }
        return strip.build()
    }

    private fun buildMapStrip(): ActionStrip {
        return ActionStrip.Builder()
            .addAction(Action.PAN)
            .addAction(mapAction(R.drawable.ic_zoom_in) { CarMap.zoomBy(1) })
            .addAction(mapAction(R.drawable.ic_zoom_out) { CarMap.zoomBy(-1) })
            .addAction(mapAction(R.drawable.ic_recenter) { CarMap.recenter() })
            .build()
    }

    private fun mapAction(icon: Int, onClick: () -> Unit): Action {
        return Action.Builder()
            .setIcon(CarIcon.Builder(IconCompat.createWithResource(carContext, icon)).build())
            .setOnClickListener(onClick)
            .build()
    }

    private fun openSearch() {
        screenManager.pushForResult(SearchScreen(carContext)) { result ->
            val place = result as? SearchResult ?: return@pushForResult
            startNavigation(place.lat, place.lon)
        }
    }

    private fun refresh() {
        carContext.mainExecutor.execute {
            if (lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) invalidate()
        }
    }

    private fun watchLocation(start: Boolean) {
        val manager = try {
            carContext.getSystemService(LocationManager::class.java)
        } catch (_: Exception) {
            null
        } ?: return
        if (!start) {
            try {
                manager.removeUpdates(locationListener)
            } catch (_: Exception) {
            }
            return
        }
        for (provider in listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)) {
            try {
                manager.requestLocationUpdates(provider, 1000L, 8f, locationListener, Looper.getMainLooper())
            } catch (_: Exception) {
            }
        }
    }

    private fun lastLocation(): Pair<Double, Double>? {
        return try {
            val manager = carContext.getSystemService(LocationManager::class.java) ?: return null
            val location = manager.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                ?: manager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
            location?.let { it.latitude to it.longitude }
        } catch (_: SecurityException) {
            null
        }
    }

    private fun resetGuidance() {
        stepIndex = 0
        hasFix = false
        shownMeters = -1.0
        farSpoken = -1
        nearSpoken = -1
        pendingSpeech = null
    }

    private fun beginGuidance(route: NavigationRoute, lat: Double, lon: Double) {
        userLat = lat
        userLon = lon
        hasFix = true
        var index = 0
        val first = route.maneuvers.first()
        if (route.maneuvers.size > 1 && haversine(lat, lon, first.location.lat, first.location.lon) < 50.0) {
            index = 1
        }
        stepIndex = index
        val step = route.maneuvers[index]
        val meters = haversine(lat, lon, step.location.lat, step.location.lon)
        shownMeters = meters
        farSpoken = if (meters < 500.0) index else -1
        nearSpoken = if (meters < 120.0) index else -1
        speak(if (meters > 80.0) "In ${spokenDistance(meters)}. ${cue(step)}" else cue(step))
    }

    private fun onFix(lat: Double, lon: Double) {
        userLat = lat
        userLon = lon
        hasFix = true
        CarMap.showLocation(lat, lon)
        val current = route ?: return
        if (current.maneuvers.isEmpty()) return
        val moved = advanceGuidance(current, lat, lon)
        val step = current.maneuvers.getOrNull(stepIndex) ?: return
        val meters = haversine(lat, lon, step.location.lat, step.location.lon)
        if (moved) {
            farSpoken = if (meters < 900.0) stepIndex else -1
            nearSpoken = if (meters < 120.0) stepIndex else -1
            when {
                meters <= 120.0 -> speak(cue(step))
                meters < 900.0 -> speak("In ${spokenDistance(meters)}. ${cue(step)}")
            }
            shownMeters = meters
            refresh()
            return
        }
        if (meters in 320.0..480.0 && farSpoken != stepIndex) {
            farSpoken = stepIndex
            speak("In 400 meters. ${cue(step)}")
        } else if (meters in 55.0..110.0 && nearSpoken != stepIndex) {
            nearSpoken = stepIndex
            speak(cue(step))
        }
        if (shownMeters < 0.0 || kotlin.math.abs(shownMeters - meters) >= 20.0) {
            shownMeters = meters
            refresh()
        }
    }

    private fun advanceGuidance(route: NavigationRoute, lat: Double, lon: Double): Boolean {
        val coords = route.geometry?.coordinates.orEmpty()
        val userAt = if (coords.size >= 2) closestVertex(coords, lat, lon) else -1
        var moved = false
        while (stepIndex < route.maneuvers.lastIndex) {
            val step = route.maneuvers[stepIndex]
            val dist = haversine(lat, lon, step.location.lat, step.location.lon)
            val turnAt = if (userAt >= 0) closestVertex(coords, step.location.lat, step.location.lon) else -1
            val passed = turnAt >= 0 && userAt > turnAt + 3 && dist < 70.0
            if (dist > 30.0 && !passed) break
            stepIndex += 1
            moved = true
        }
        return moved
    }

    private fun closestVertex(coords: List<List<Double>>, lat: Double, lon: Double): Int {
        var best = 0
        var bestD = Double.MAX_VALUE
        for (i in coords.indices) {
            val point = coords[i]
            if (point.size < 2) continue
            val dLat = point[1] - lat
            val dLon = point[0] - lon
            val score = dLat * dLat + dLon * dLon
            if (score < bestD) {
                bestD = score
                best = i
            }
        }
        return best
    }

    private fun fallbackMeters(route: NavigationRoute, index: Int): Double {
        if (index > 0) return route.maneuvers[index - 1].distance
        return route.maneuvers[index].distance
    }

    private fun remainingTrip(route: NavigationRoute, index: Int, toTurn: Double): Double {
        var sum = toTurn.coerceAtLeast(0.0)
        for (i in index until route.maneuvers.size) {
            val leg = route.maneuvers[i].distance
            if (leg.isFinite() && leg > 0.0) sum += leg
        }
        return sum
    }

    private fun cue(step: RouteManeuver): String {
        return step.instruction.ifBlank { "Continue" }
    }

    private fun spokenDistance(meters: Double): String {
        if (meters >= 1000.0) {
            val km = meters / 1000.0
            val text = if (km >= 10.0) km.toInt().toString() else String.format(Locale.US, "%.1f", km)
            return "$text kilometers"
        }
        val rounded = when {
            meters >= 200.0 -> (meters / 50.0).toInt() * 50
            else -> ((meters / 10.0).toInt() * 10).coerceAtLeast(10)
        }
        return "$rounded meters"
    }

    private fun speak(text: String) {
        if (text.isBlank()) return
        if (!ttsReady) {
            pendingSpeech = text
            return
        }
        pendingSpeech = null
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "serika-nav")
    }

    private fun haversine(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val dLat = (lat2 - lat1) * Math.PI / 180.0
        val dLon = (lon2 - lon1) * Math.PI / 180.0
        val a = sin(dLat / 2) * sin(dLat / 2) +
            cos(lat1 * Math.PI / 180.0) * cos(lat2 * Math.PI / 180.0) * sin(dLon / 2) * sin(dLon / 2)
        return 6371000.0 * 2 * atan2(sqrt(a), sqrt(1 - a))
    }

    private fun mapManeuverType(type: String, modifier: String?): Int {
        val right = modifier?.contains("right") == true
        val uturn = modifier == "uturn"
        return when (type) {
            "DEPART" -> Maneuver.TYPE_DEPART
            "ARRIVE" -> Maneuver.TYPE_DESTINATION
            "TURN" -> when {
                uturn && right -> Maneuver.TYPE_U_TURN_RIGHT
                uturn -> Maneuver.TYPE_U_TURN_LEFT
                right -> Maneuver.TYPE_TURN_NORMAL_RIGHT
                else -> Maneuver.TYPE_TURN_NORMAL_LEFT
            }
            "MERGE" -> if (right) Maneuver.TYPE_MERGE_RIGHT else Maneuver.TYPE_MERGE_LEFT
            "FORK" -> if (right) Maneuver.TYPE_FORK_RIGHT else Maneuver.TYPE_FORK_LEFT
            "ROUNDABOUT" -> Maneuver.TYPE_ROUNDABOUT_ENTER_CW
            "ON_RAMP" -> if (right) Maneuver.TYPE_ON_RAMP_NORMAL_RIGHT else Maneuver.TYPE_ON_RAMP_NORMAL_LEFT
            "OFF_RAMP" -> if (right) Maneuver.TYPE_OFF_RAMP_NORMAL_RIGHT else Maneuver.TYPE_OFF_RAMP_NORMAL_LEFT
            else -> Maneuver.TYPE_STRAIGHT
        }
    }
}
