package dev.serika.maps.data

import dev.serika.maps.SerikaMapsApp
import dev.serika.maps.data.models.NavigationRoute
import dev.serika.maps.data.models.SearchResult
import kotlinx.serialization.json.Json
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.Locale
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * HTTP client for the Serika Maps API.
 */
class ApiClient {

    private val baseUrl = SerikaMapsApp.API_BASE_URL
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun searchPlaces(
        query: String,
        limit: Int = 8,
        biasLat: Double? = null,
        biasLon: Double? = null,
    ): List<SearchResult> {
        val encoded = URLEncoder.encode(query.trim(), "UTF-8")
        val bias = if (biasLat != null && biasLon != null) "&lat=$biasLat&lon=$biasLon" else ""
        val url = "$baseUrl/api/geocode/search?q=$encoded&limit=$limit$bias"
        val raw = json.decodeFromString<List<SearchResult>>(fetchUrl(url))
        val presented = raw.map { present(it, biasLat, biasLon) }
        return dedupe(presented).let { results ->
            if (biasLat != null && biasLon != null && CATEGORY_QUERIES.contains(query.trim().lowercase())) {
                results.sortedBy { haversine(biasLat, biasLon, it.lat, it.lon) }
            } else {
                results
            }
        }.take(6)
    }

    suspend fun getNavigationRoute(
        originLat: Double,
        originLon: Double,
        destLat: Double,
        destLon: Double,
        mode: String = "driving",
    ): NavigationRoute {
        val url = "$baseUrl/api/navigation/route?" +
                "origin_lat=$originLat&origin_lon=$originLon" +
                "&dest_lat=$destLat&dest_lon=$destLon" +
                "&mode=$mode"
        return json.decodeFromString(fetchUrl(url))
    }

    private fun fetchUrl(urlString: String): String {
        val connection = URL(urlString).openConnection() as HttpURLConnection
        connection.requestMethod = "GET"
        connection.setRequestProperty("User-Agent", "SerikaMaps-Android/1.0 (https://maps.serika.dev)")
        connection.connectTimeout = 10_000
        connection.readTimeout = 10_000

        return try {
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val body = stream?.bufferedReader()?.readText().orEmpty()
            if (code !in 200..299) {
                throw java.io.IOException("HTTP $code")
            }
            body
        } finally {
            connection.disconnect()
        }
    }
}

private val CATEGORY_QUERIES = setOf(
    "restaurant", "restaurants", "cafe", "cafes", "coffee", "hotel", "hotels",
    "park", "parks", "hospital", "pharmacy", "gas", "fuel", "station",
    "supermarket", "grocery", "atm", "parking", "bar", "museum", "school",
)

private fun present(result: SearchResult, biasLat: Double?, biasLon: Double?): SearchResult {
    val parts = result.displayName.split(",")
        .map { it.trim() }
        .filter { it.isNotBlank() }
        .distinct()
    val house = parts.firstOrNull()?.takeIf { it.all(Char::isDigit) }
    val title = when {
        house != null && parts.size >= 2 -> "${parts[1]} $house"
        result.name.isNotBlank() && result.name != house -> result.name
        parts.isNotEmpty() -> parts.first()
        else -> "Place"
    }.take(48)
    val hidden = setOf(title, result.name, house).filterNotNull().map { it.lowercase() }.toSet()
    val subtitle = parts
        .filter { part ->
            part.lowercase() !in hidden &&
                !part.matches(Regex("\\d{4}\\s*[A-Za-z]{2}"))
        }
        .take(3)
        .joinToString(", ")
    val distance = if (biasLat != null && biasLon != null) {
        formatDistance(haversine(biasLat, biasLon, result.lat, result.lon))
    } else {
        null
    }
    return result.copy(
        name = title.ifBlank { "Place" },
        displayName = listOfNotNull(distance, subtitle.ifBlank { null }).joinToString(" · ").take(80),
    )
}

private fun dedupe(results: List<SearchResult>): List<SearchResult> {
    val kept = mutableListOf<SearchResult>()
    for (result in results) {
        val duplicate = kept.any {
            it.name.equals(result.name, ignoreCase = true) &&
                haversine(it.lat, it.lon, result.lat, result.lon) < 800
        }
        if (!duplicate) kept.add(result)
    }
    return kept
}

private fun haversine(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
    val r = 6371000.0
    val dLat = Math.toRadians(lat2 - lat1)
    val dLon = Math.toRadians(lon2 - lon1)
    val a = sin(dLat / 2) * sin(dLat / 2) +
            cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) *
            sin(dLon / 2) * sin(dLon / 2)
    return r * 2 * atan2(sqrt(a), sqrt(1 - a))
}

private fun formatDistance(meters: Double): String {
    return if (meters < 950) {
        "${(meters / 10).toInt() * 10} m"
    } else {
        val km = meters / 1000
        if (km < 10) String.format(Locale.US, "%.1f km", km) else "${km.toInt()} km"
    }
}
