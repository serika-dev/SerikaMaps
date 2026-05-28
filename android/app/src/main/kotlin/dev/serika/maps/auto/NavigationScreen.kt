package dev.serika.maps.auto

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.*
import androidx.car.app.navigation.model.*
import dev.serika.maps.data.ApiClient
import dev.serika.maps.data.models.NavigationRoute
import dev.serika.maps.navigation.NavigationManager
import kotlinx.coroutines.*

/**
 * Navigation screen displayed on the Android Auto head unit.
 * Uses NavigationTemplate to show turn-by-turn directions.
 */
class NavigationScreen(
    carContext: CarContext,
    private val destLat: Double,
    private val destLon: Double,
) : Screen(carContext) {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val apiClient = ApiClient()
    private val navManager = NavigationManager()
    private var route: NavigationRoute? = null
    private var currentStepIndex = 0
    private var isNavigating = false

    init {
        loadRoute()
    }

    private fun loadRoute() {
        scope.launch {
            try {
                // Get user's current location
                val userLat = 48.8566 // TODO: get from LocationManager
                val userLon = 2.3522

                route = apiClient.getNavigationRoute(
                    originLat = userLat,
                    originLon = userLon,
                    destLat = destLat,
                    destLon = destLon,
                )
                isNavigating = true
                withContext(Dispatchers.Main) {
                    invalidate() // Refresh UI
                }
            } catch (e: Exception) {
                android.util.Log.e("SerikaMaps", "Failed to load route", e)
            }
        }
    }

    override fun onGetTemplate(): Template {
        val currentRoute = route

        if (currentRoute == null || !isNavigating) {
            // Loading state
            return NavigationTemplate.Builder()
                .setNavigationInfo(
                    RoutingInfo.Builder()
                        .setLoading(true)
                        .build()
                )
                .setActionStrip(buildActionStrip())
                .build()
        }

        val maneuvers = currentRoute.maneuvers
        val currentStep = maneuvers.getOrNull(currentStepIndex)
        val nextStep = maneuvers.getOrNull(currentStepIndex + 1)

        val routingInfoBuilder = RoutingInfo.Builder()

        if (currentStep != null) {
            val stepBuilder = Step.Builder(currentStep.instruction)
                .setManeuver(
                    Maneuver.Builder(mapManeuverType(currentStep.type))
                        .build()
                )
                .setRoad(currentStep.streetName)

            routingInfoBuilder.setCurrentStep(
                stepBuilder.build(),
                Distance.create(currentStep.distance, Distance.UNIT_METERS)
            )
        }

        if (nextStep != null) {
            val nextStepBuilder = Step.Builder(nextStep.instruction)
                .setManeuver(
                    Maneuver.Builder(mapManeuverType(nextStep.type))
                        .build()
                )

            routingInfoBuilder.setNextStep(nextStepBuilder.build())
        }

        return NavigationTemplate.Builder()
            .setNavigationInfo(routingInfoBuilder.build())
            .setDestinationTravelEstimate(
                TravelEstimate.Builder(
                    Distance.create(currentRoute.totalDistance, Distance.UNIT_METERS),
                    DateTimeWithZone.create(
                        System.currentTimeMillis() + (currentRoute.totalDuration * 1000).toLong(),
                        java.util.TimeZone.getDefault()
                    )
                ).build()
            )
            .setActionStrip(buildActionStrip())
            .build()
    }

    private fun buildActionStrip(): ActionStrip {
        return ActionStrip.Builder()
            .addAction(
                Action.Builder()
                    .setTitle("Stop")
                    .setOnClickListener {
                        isNavigating = false
                        screenManager.pop()
                    }
                    .build()
            )
            .build()
    }

    private fun mapManeuverType(type: String): Int {
        return when (type) {
            "DEPART" -> Maneuver.TYPE_DEPART
            "ARRIVE" -> Maneuver.TYPE_DESTINATION
            "TURN" -> Maneuver.TYPE_TURN_NORMAL_LEFT
            "STRAIGHT" -> Maneuver.TYPE_STRAIGHT
            "MERGE" -> Maneuver.TYPE_MERGE_SIDE_UNSPECIFIED
            "FORK" -> Maneuver.TYPE_FORK_LEFT
            "ROUNDABOUT" -> Maneuver.TYPE_ROUNDABOUT_ENTER_AND_EXIT_CW
            "ON_RAMP" -> Maneuver.TYPE_ON_RAMP_NORMAL_RIGHT
            "OFF_RAMP" -> Maneuver.TYPE_OFF_RAMP_NORMAL_RIGHT
            else -> Maneuver.TYPE_STRAIGHT
        }
    }

    override fun onStop(owner: androidx.lifecycle.LifecycleOwner) {
        super.onStop(owner)
        scope.cancel()
    }
}
