package dev.serika.maps.data

import dev.serika.maps.SerikaMapsApp
import dev.serika.maps.data.models.NavigationRoute
import dev.serika.maps.data.models.SearchResult
import kotlinx.serialization.json.Json
import java.net.URL
import java.net.URLEncoder

/**
 * HTTP client for the Serika Maps Elysia.js API.
 * Uses simple HttpURLConnection for lightweight networking.
 */
class ApiClient {

    private val baseUrl = SerikaMapsApp.API_BASE_URL
    private val json = Json { ignoreUnknownKeys = true }

    /**
     * Search for places using the geocode endpoint.
     */
    suspend fun searchPlaces(query: String, limit: Int = 6): List<SearchResult> {
        val encoded = URLEncoder.encode(query, "UTF-8")
        val url = "$baseUrl/api/geocode/search?q=$encoded&limit=$limit"
        val response = fetchUrl(url)
        return json.decodeFromString<List<SearchResult>>(response)
    }

    /**
     * Get a structured navigation route for Android Auto.
     */
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
        val response = fetchUrl(url)
        return json.decodeFromString<NavigationRoute>(response)
    }

    private fun fetchUrl(urlString: String): String {
        val connection = URL(urlString).openConnection() as java.net.HttpURLConnection
        connection.requestMethod = "GET"
        connection.setRequestProperty("User-Agent", "SerikaMaps-Android/1.0")
        connection.connectTimeout = 10_000
        connection.readTimeout = 10_000

        return try {
            connection.inputStream.bufferedReader().readText()
        } finally {
            connection.disconnect()
        }
    }
}
