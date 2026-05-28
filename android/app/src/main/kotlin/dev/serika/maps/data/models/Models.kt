package dev.serika.maps.data.models

import kotlinx.serialization.Serializable

@Serializable
data class SearchResult(
    val id: String,
    val name: String,
    val displayName: String,
    val lat: Double,
    val lon: Double,
    val type: String,
)

@Serializable
data class NavigationRoute(
    val totalDuration: Double,
    val totalDistance: Double,
    val estimatedArrival: String,
    val maneuvers: List<Maneuver>,
)

@Serializable
data class Maneuver(
    val index: Int,
    val type: String,
    val modifier: String?,
    val streetName: String,
    val distance: Double,
    val duration: Double,
    val instruction: String,
    val location: Location,
)

@Serializable
data class Location(
    val lat: Double,
    val lon: Double,
)
