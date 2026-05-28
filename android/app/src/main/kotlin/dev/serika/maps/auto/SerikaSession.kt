package dev.serika.maps.auto

import android.content.Intent
import androidx.car.app.Screen
import androidx.car.app.Session

/**
 * Manages the lifecycle of an Android Auto navigation session.
 */
class SerikaSession : Session() {

    override fun onCreateScreen(intent: Intent): Screen {
        // Check if launched with a navigation intent
        val destLat = intent.getDoubleExtra("dest_lat", 0.0)
        val destLon = intent.getDoubleExtra("dest_lon", 0.0)

        return if (destLat != 0.0 && destLon != 0.0) {
            NavigationScreen(carContext, destLat, destLon)
        } else {
            SearchScreen(carContext)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // Handle new navigation intents while session is active
        val destLat = intent.getDoubleExtra("dest_lat", 0.0)
        val destLon = intent.getDoubleExtra("dest_lon", 0.0)

        if (destLat != 0.0 && destLon != 0.0) {
            carContext.getCarService(androidx.car.app.ScreenManager::class.java)
                .push(NavigationScreen(carContext, destLat, destLon))
        }
    }
}
