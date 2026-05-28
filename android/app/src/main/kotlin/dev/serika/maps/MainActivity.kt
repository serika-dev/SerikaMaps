package dev.serika.maps

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
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

// ... rest of imports are preserved because this targets from the class definition down ...

class MainActivity : AppCompatActivity() {

    private val locationPermissionRequest = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        // Handle permission results if needed
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
    }

    private fun requestLocationPermissions() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            locationPermissionRequest.launch(
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
            )
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
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
                    // Retain the prompt so the user can try again after granting
                }
            }
        }
        
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
