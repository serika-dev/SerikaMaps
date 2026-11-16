package dev.serika.maps.auto

import android.location.LocationManager
import android.util.Log
import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.ActionStrip
import androidx.car.app.model.DateTimeWithZone
import androidx.car.app.model.Distance
import androidx.car.app.model.MessageTemplate
import androidx.car.app.model.Template
import androidx.car.app.navigation.model.Maneuver
import androidx.car.app.navigation.model.NavigationTemplate
import androidx.car.app.navigation.model.RoutingInfo
import androidx.car.app.navigation.model.Step
import androidx.car.app.navigation.model.TravelEstimate
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import dev.serika.maps.data.ApiClient
import dev.serika.maps.data.models.Maneuver as RouteManeuver
import dev.serika.maps.data.models.NavigationRoute
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Turn-by-turn screen. The host rejects this template unless the app declares
 * androidx.car.app.NAVIGATION_TEMPLATES.
 */
class NavigationScreen(
    carContext: CarContext,
    private val destLat: Double,
    private val destLon: Double,
) : Screen(carContext) {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val apiClient = ApiClient()
    private var route: NavigationRoute? = null
    private var error: String? = null

    init {
        loadRoute()
        lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onDestroy(owner: LifecycleOwner) {
                scope.cancel()
            }
        })
    }

    private fun loadRoute() {
        scope.launch {
            try {
                val location = lastLocation()
                if (location == null) {
                    error = "Location is off, so a route cannot be started"
                    withContext(Dispatchers.Main) { invalidate() }
                    return@launch
                }
                CarMap.setView(location.first, location.second, emptyList())
                route = apiClient.getNavigationRoute(
                    originLat = location.first,
                    originLon = location.second,
                    destLat = destLat,
                    destLon = destLon,
                )
                val loaded = route
                if (loaded == null || loaded.maneuvers.isEmpty()) {
                    error = "No driving route was found"
                } else {
                    CarMap.setView(location.first, location.second, loaded.geometry?.coordinates.orEmpty())
                }
            } catch (e: Exception) {
                error = "The route could not be loaded"
                Log.e("SerikaMaps", "Failed to load route", e)
            }
            withContext(Dispatchers.Main) { invalidate() }
        }
    }

    override fun onGetTemplate(): Template {
        return try {
            buildTemplate()
        } catch (e: Exception) {
            Log.e("SerikaMaps", "Navigation template rejected", e)
            failureTemplate("This route could not be shown")
        }
    }

    private fun buildTemplate(): Template {
        error?.let { return failureTemplate(it) }
        val currentRoute = route ?: return loadingTemplate()
        val currentStep = currentRoute.maneuvers.getOrNull(0) ?: return failureTemplate("No driving route was found")
        val nextStep = currentRoute.maneuvers.getOrNull(1)

        val routingInfo = RoutingInfo.Builder()
            .setCurrentStep(buildStep(currentStep), meters(currentStep.distance))
        if (nextStep != null) {
            routingInfo.setNextStep(buildStep(nextStep))
        }

        return NavigationTemplate.Builder()
            .setNavigationInfo(routingInfo.build())
            .setDestinationTravelEstimate(
                TravelEstimate.Builder(
                    meters(currentRoute.totalDistance),
                    DateTimeWithZone.create(
                        System.currentTimeMillis() + (currentRoute.totalDuration.coerceAtLeast(0.0) * 1000).toLong(),
                        java.util.TimeZone.getDefault()
                    )
                ).build()
            )
            .setActionStrip(buildActionStrip())
            .build()
    }

    private fun loadingTemplate(): Template {
        return NavigationTemplate.Builder()
            .setNavigationInfo(RoutingInfo.Builder().setLoading(true).build())
            .setActionStrip(buildActionStrip())
            .build()
    }

    private fun failureTemplate(message: String): Template {
        return MessageTemplate.Builder(message)
            .setHeaderAction(Action.BACK)
            .build()
    }

    private fun buildStep(step: RouteManeuver): Step {
        val cue = step.instruction.ifBlank { "Continue" }.take(90)
        return Step.Builder(cue)
            .setManeuver(Maneuver.Builder(mapManeuverType(step.type, step.modifier)).build())
            .setRoad(roadLabel(step))
            .build()
    }

    private fun roadLabel(step: RouteManeuver): String {
        val street = step.streetName.trim()
        if (street.isNotEmpty()) return street.take(36)
        val onto = step.instruction.substringAfter(" onto ", "")
        if (onto.isNotBlank() && !onto.equals("the road", ignoreCase = true)) return onto.take(36)
        return step.instruction.ifBlank { "Route" }.take(36)
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
        return ActionStrip.Builder()
            .addAction(
                Action.Builder()
                    .setTitle("Stop")
                    .setOnClickListener { screenManager.pop() }
                    .build()
            )
            .build()
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
