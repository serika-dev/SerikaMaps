package dev.serika.maps

import android.app.Application

class SerikaMapsApp : Application() {
    
    companion object {
        const val API_BASE_URL = "https://api-maps.serika.dev"
        const val TAG = "SerikaMaps"
    }

    override fun onCreate() {
        super.onCreate()
        // Initialize dependencies (networking, etc.)
    }
}
