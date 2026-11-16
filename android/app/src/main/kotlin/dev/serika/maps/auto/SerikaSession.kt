package dev.serika.maps.auto

import android.content.Intent
import androidx.car.app.Screen
import androidx.car.app.Session

/**
 * Manages the lifecycle of an Android Auto navigation session.
 */
class SerikaSession : Session() {

    override fun onCreateScreen(intent: Intent): Screen {
        CarMap.attach(carContext)
        // Check if launched with a navigation intent
        val destLat = intent.getDoubleExtra("dest_lat", 0.0)
        val destLon = intent.getDoubleExtra("dest_lon", 0.0)

        val screen = NavigationScreen(carContext)
        if (destLat != 0.0 && destLon != 0.0) screen.startNavigation(destLat, destLon)
        return screen
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val destLat = intent.getDoubleExtra("dest_lat", 0.0)
        val destLon = intent.getDoubleExtra("dest_lon", 0.0)
        if (destLat == 0.0 || destLon == 0.0) return
        val manager = carContext.getCarService(androidx.car.app.ScreenManager::class.java)
        manager.popToRoot()
        (manager.top as? NavigationScreen)?.startNavigation(destLat, destLon)
    }
}
