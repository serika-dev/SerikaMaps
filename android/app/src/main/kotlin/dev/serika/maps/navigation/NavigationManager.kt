package dev.serika.maps.navigation

import dev.serika.maps.data.models.NavigationRoute

/**
 * Manages active navigation state including current step tracking,
 * off-route detection, and ETA recalculation.
 */
class NavigationManager {

    private var activeRoute: NavigationRoute? = null
    private var currentStepIndex: Int = 0
    private var isNavigating: Boolean = false

    fun startNavigation(route: NavigationRoute) {
        activeRoute = route
        currentStepIndex = 0
        isNavigating = true
    }

    fun stopNavigation() {
        activeRoute = null
        currentStepIndex = 0
        isNavigating = false
    }

    /**
     * Update the user's position and determine the current navigation step.
     * Returns the index of the current step, or -1 if navigation is complete.
     */
    fun updatePosition(lat: Double, lon: Double): Int {
        val route = activeRoute ?: return -1
        if (!isNavigating) return -1

        // Find the nearest maneuver point
        val maneuvers = route.maneuvers
        if (currentStepIndex >= maneuvers.size) {
            stopNavigation()
            return -1
        }

        // Simple distance-based step advancement
        val currentManeuver = maneuvers[currentStepIndex]
        val dist = haversineDistance(
            lat, lon,
            currentManeuver.location.lat, currentManeuver.location.lon
        )

        // If within 30m of the next maneuver, advance
        if (dist < 30.0 && currentStepIndex < maneuvers.size - 1) {
            currentStepIndex++
        }

        return currentStepIndex
    }

    fun getCurrentStepIndex(): Int = currentStepIndex
    fun isActive(): Boolean = isNavigating
    fun getActiveRoute(): NavigationRoute? = activeRoute

    /**
     * Haversine formula to calculate distance between two coordinates in meters.
     */
    private fun haversineDistance(
        lat1: Double, lon1: Double,
        lat2: Double, lon2: Double
    ): Double {
        val r = 6371000.0 // Earth's radius in meters
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2)
        val c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return r * c
    }
}
