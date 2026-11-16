package dev.serika.maps.auto

import android.location.LocationManager
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.ItemList
import androidx.car.app.model.Row
import androidx.car.app.model.SearchTemplate
import androidx.car.app.model.Template
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import dev.serika.maps.data.ApiClient
import dev.serika.maps.data.models.SearchResult
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Android Auto destination search. Refreshes are posted off the search
 * callback so the host does not wipe the text the driver is typing.
 */
class SearchScreen(carContext: CarContext) : Screen(carContext) {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val apiClient = ApiClient()
    private var query = ""
    private var searchResults: List<SearchResult> = emptyList()
    private var isLoading = false
    private var message = "Search for a place or address"
    private var searchJob: Job? = null

    init {
        lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onDestroy(owner: LifecycleOwner) {
                scope.cancel()
            }
        })
    }

    override fun onGetTemplate(): Template {
        val template = SearchTemplate.Builder(
            object : SearchTemplate.SearchCallback {
                override fun onSearchTextChanged(searchText: String) {
                    scheduleSearch(searchText)
                }

                override fun onSearchSubmitted(searchText: String) {
                    scheduleSearch(searchText, immediate = true)
                }
            }
        )
            .setHeaderAction(Action.APP_ICON)
            .setInitialSearchText(query)
            .setSearchHint("Place, address, or city")
            .setShowKeyboardByDefault(query.isEmpty())

        // A loading SearchTemplate cannot also carry an item list.
        if (isLoading) {
            return template.setLoading(true).build()
        }

        val listBuilder = ItemList.Builder()
        if (searchResults.isEmpty()) {
            listBuilder.setNoItemsMessage(message)
        } else {
            searchResults.take(6).forEach { result ->
                val row = Row.Builder()
                    .setTitle(result.name.ifBlank { "Place" })
                    .setOnClickListener {
                        screenManager.push(
                            NavigationScreen(carContext, result.lat, result.lon)
                        )
                    }
                if (result.displayName.isNotBlank()) {
                    row.addText(result.displayName)
                }
                listBuilder.addItem(row.build())
            }
        }
        return template.setItemList(listBuilder.build()).build()
    }

    private fun scheduleSearch(searchText: String, immediate: Boolean = false) {
        query = searchText
        searchJob?.cancel()
        val trimmed = searchText.trim()
        if (trimmed.length < 2) {
            val changed = searchResults.isNotEmpty() || isLoading
            searchResults = emptyList()
            isLoading = false
            message = "Search for a place or address"
            if (changed) refresh()
            return
        }

        searchJob = scope.launch {
            if (!immediate) delay(280)
            isLoading = true
            refresh()
            try {
                val bias = lastLocation()
                val results = apiClient.searchPlaces(
                    query = trimmed,
                    biasLat = bias?.first,
                    biasLon = bias?.second,
                )
                if (query.trim() != trimmed) return@launch
                searchResults = results
                message = if (results.isEmpty()) "No places match" else message
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                if (query.trim() != trimmed) return@launch
                searchResults = emptyList()
                message = "Search is unavailable"
                Log.e("SerikaMaps", "Search failed", e)
            }
            isLoading = false
            refresh()
        }
    }

    private fun refresh() {
        // mainExecutor runs inline on the main thread, which is where the host
        // delivers search callbacks. Post so invalidate() happens after the callback.
        Handler(Looper.getMainLooper()).post {
            invalidate()
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
}
