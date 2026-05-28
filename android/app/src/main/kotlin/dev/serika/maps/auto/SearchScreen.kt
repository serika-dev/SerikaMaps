package dev.serika.maps.auto

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.*
import dev.serika.maps.data.ApiClient
import dev.serika.maps.data.models.SearchResult
import kotlinx.coroutines.*

/**
 * Search screen for Android Auto — allows users to search for destinations
 * using the distraction-optimized SearchTemplate.
 */
class SearchScreen(carContext: CarContext) : Screen(carContext) {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val apiClient = ApiClient()
    private var searchResults: List<SearchResult> = emptyList()
    private var isLoading = false

    override fun onGetTemplate(): Template {
        val listBuilder = ItemList.Builder()

        if (isLoading) {
            listBuilder.setNoItemsMessage("Searching...")
        } else if (searchResults.isEmpty()) {
            listBuilder.setNoItemsMessage("Search for a destination")
        } else {
            searchResults.take(6).forEach { result ->
                listBuilder.addItem(
                    Row.Builder()
                        .setTitle(result.name)
                        .addText(result.displayName)
                        .setOnClickListener {
                            // Navigate to this destination
                            screenManager.push(
                                NavigationScreen(
                                    carContext,
                                    result.lat,
                                    result.lon
                                )
                            )
                        }
                        .build()
                )
            }
        }

        return SearchTemplate.Builder(
            object : SearchTemplate.SearchCallback {
                override fun onSearchTextChanged(searchText: String) {
                    if (searchText.length >= 2) {
                        performSearch(searchText)
                    }
                }

                override fun onSearchSubmitted(searchText: String) {
                    performSearch(searchText)
                }
            }
        )
            .setHeaderAction(Action.APP_ICON)
            .setItemList(listBuilder.build())
            .setShowKeyboardByDefault(true)
            .build()
    }

    private fun performSearch(query: String) {
        isLoading = true
        invalidate()

        scope.launch {
            try {
                searchResults = apiClient.searchPlaces(query)
            } catch (e: Exception) {
                searchResults = emptyList()
                android.util.Log.e("SerikaMaps", "Search failed", e)
            }
            isLoading = false
            withContext(Dispatchers.Main) {
                invalidate()
            }
        }
    }

    override fun onStop(owner: androidx.lifecycle.LifecycleOwner) {
        super.onStop(owner)
        scope.cancel()
    }
}
