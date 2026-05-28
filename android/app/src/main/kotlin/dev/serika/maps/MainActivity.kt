package dev.serika.maps

import android.annotation.SuppressLint
import android.content.Context
import android.content.BroadcastReceiver
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.JavascriptInterface
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

import android.Manifest
import android.content.pm.PackageManager
import android.webkit.GeolocationPermissions
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import dev.serika.maps.navigation.NavigationService

class MainActivity : AppCompatActivity() {

    private val locationPermissionRequest = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        // Handle permission results if needed
    }

    private val locationReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val lat = intent?.getDoubleExtra("latitude", 0.0) ?: 0.0
            val lon = intent?.getDoubleExtra("longitude", 0.0) ?: 0.0
            val bearing = intent?.getFloatExtra("bearing", 0f) ?: 0f
            val speed = intent?.getFloatExtra("speed", 0f) ?: 0f
            
            val webView = findViewById<WebView>(R.id.webView)
            webView.post {
                webView.evaluateJavascript(
                    "if (window.updateBackgroundLocation) { window.updateBackgroundLocation($lon, $lat, $bearing, $speed); }",
                    null
                )
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).let { controller ->
            controller.hide(WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
        
        requestLocationPermissions()
        setupWebView()
        checkForUpdates()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val webView = findViewById<WebView>(R.id.webView)
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        // Register BroadcastReceiver for navigation background updates
        val filter = IntentFilter("dev.serika.maps.LOCATION_UPDATE")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(locationReceiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            registerReceiver(locationReceiver, filter)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            unregisterReceiver(locationReceiver)
        } catch (e: Exception) {
            // ignore
        }
    }

    private fun requestLocationPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        val missingPermissions = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (missingPermissions.isNotEmpty()) {
            locationPermissionRequest.launch(missingPermissions.toTypedArray())
        }
    }

    @SuppressLint("SetJavaScriptEnabled", "AddJavascriptInterface")
    private fun setupWebView() {
        val webView = findViewById<WebView>(R.id.webView)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.setGeolocationEnabled(true)
        webView.settings.cacheMode = WebSettings.LOAD_DEFAULT
        webView.webViewClient = WebViewClient()
        
        webView.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(
                origin: String,
                callback: GeolocationPermissions.Callback
            ) {
                if (ContextCompat.checkSelfPermission(
                        this@MainActivity,
                        Manifest.permission.ACCESS_FINE_LOCATION
                    ) == PackageManager.PERMISSION_GRANTED
                ) {
                    callback.invoke(origin, true, false)
                } else {
                    requestLocationPermissions()
                }
            }
        }
        
        // Add Javascript Bridge for peak background navigation control
        webView.addJavascriptInterface(WebAppInterface(this), "Android")
        
        webView.loadUrl("https://maps.serika.dev")
    }

    private fun checkForUpdates() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val url = URL("https://api.github.com/repos/serika-dev/SerikaMaps/releases/latest")
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "GET"
                connection.setRequestProperty("User-Agent", "SerikaMaps-Android")

                val response = connection.inputStream.bufferedReader().readText()
                val json = JSONObject(response)
                
                val latestTag = json.optString("tag_name", "")
                val currentVersion = "v${BuildConfig.VERSION_NAME}"
                
                if (latestTag.isNotEmpty() && latestTag != currentVersion) {
                    val currentParts = currentVersion.replace("v", "").split(".")
                    val latestParts = latestTag.replace("v", "").split(".")
                    
                    var isNewer = false
                    for (i in 0 until minOf(currentParts.size, latestParts.size)) {
                        val curr = currentParts[i].toIntOrNull() ?: 0
                        val lat = latestParts[i].toIntOrNull() ?: 0
                        if (lat > curr) {
                            isNewer = true
                            break
                        } else if (lat < curr) {
                            break
                        }
                    }
                    
                    if (isNewer) {
                        val releaseUrl = json.optString("html_url", "https://github.com/serika-dev/SerikaMaps/releases/latest")
                        withContext(Dispatchers.Main) {
                            if (!isFinishing && !isDestroyed) {
                                showUpdateDialog(latestTag, releaseUrl)
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e("SerikaMaps", "Failed to check for updates", e)
            }
        }
    }

    private fun showUpdateDialog(version: String, url: String) {
        MaterialAlertDialogBuilder(this)
            .setTitle("Update Available")
            .setMessage("A new version of Serika Maps ($version) is available on GitHub. Would you like to download it?")
            .setPositiveButton("Download") { _, _ ->
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                startActivity(intent)
            }
            .setNegativeButton("Later", null)
            .show()
    }
}

class WebAppInterface(private val context: Context) {

    @JavascriptInterface
    fun startBackgroundNavigation(stepsJson: String, totalDistance: Double, totalDuration: Double, language: String) {
        val intent = Intent(context, NavigationService::class.java).apply {
            action = NavigationService.ACTION_START
            putExtra(NavigationService.EXTRA_STEPS, stepsJson)
            putExtra(NavigationService.EXTRA_DISTANCE, totalDistance)
            putExtra(NavigationService.EXTRA_DURATION, totalDuration)
            putExtra("language", language)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
    }

    @JavascriptInterface
    fun updateNavigationState(stepIndex: Int) {
        val intent = Intent(context, NavigationService::class.java).apply {
            action = NavigationService.ACTION_UPDATE
            putExtra(NavigationService.EXTRA_STEP_INDEX, stepIndex)
        }
        context.startService(intent)
    }

    @JavascriptInterface
    fun stopBackgroundNavigation() {
        val intent = Intent(context, NavigationService::class.java).apply {
            action = NavigationService.ACTION_STOP
        }
        context.startService(intent)
    }
}
