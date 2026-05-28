package dev.serika.maps

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        findViewById<Button>(R.id.checkUpdateButton).setOnClickListener {
            checkForUpdates(manual = true)
            Toast.makeText(this, "Checking for updates...", Toast.LENGTH_SHORT).show()
        }
        
        // Auto-check on launch
        checkForUpdates(manual = false)
    }

    private fun checkForUpdates(manual: Boolean) {
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
                    } else if (manual) {
                        withContext(Dispatchers.Main) {
                            Toast.makeText(this@MainActivity, "You are on the latest version!", Toast.LENGTH_SHORT).show()
                        }
                    }
                } else if (manual) {
                    withContext(Dispatchers.Main) {
                        Toast.makeText(this@MainActivity, "You are on the latest version!", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                Log.e("SerikaMaps", "Failed to check for updates", e)
                if (manual) {
                    withContext(Dispatchers.Main) {
                        Toast.makeText(this@MainActivity, "Failed to check for updates.", Toast.LENGTH_SHORT).show()
                    }
                }
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
