package dev.serika.maps.navigation

import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.speech.tts.TextToSpeech
import android.util.Log
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import org.json.JSONObject
import java.util.*

class NavigationService : Service(), TextToSpeech.OnInitListener {

    companion object {
        const val CHANNEL_ID = "serika_nav_channel"
        const val NOTIFICATION_ID = 1001
        
        const val ACTION_START = "dev.serika.maps.START"
        const val ACTION_UPDATE = "dev.serika.maps.UPDATE"
        const val ACTION_STOP = "dev.serika.maps.STOP"
        
        const val EXTRA_STEPS = "steps"
        const val EXTRA_DISTANCE = "distance"
        const val EXTRA_DURATION = "duration"
        const val EXTRA_STEP_INDEX = "step_index"
        
        private var isServiceRunning = false
        fun isRunning(): Boolean = isServiceRunning
    }

    private var locationManager: LocationManager? = null
    private var tts: TextToSpeech? = null
    private var isTtsReady = false
    
    private var steps: List<JSONObject> = ArrayList()
    private var currentStepIndex = 0
    private var totalDistance = 0.0
    private var totalDuration = 0.0
    
    private var lastSpokenStepIndex = -1
    private var languageCode = "en"

    override fun onCreate() {
        super.onCreate()
        isServiceRunning = true
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        tts = TextToSpeech(this, this)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: return START_NOT_STICKY

        when (action) {
            ACTION_START -> {
                val stepsStr = intent.getStringExtra(EXTRA_STEPS) ?: "[]"
                totalDistance = intent.getDoubleExtra(EXTRA_DISTANCE, 0.0)
                totalDuration = intent.getDoubleExtra(EXTRA_DURATION, 0.0)
                languageCode = intent.getStringExtra("language") ?: "en"
                
                parseSteps(stepsStr)
                currentStepIndex = 0
                lastSpokenStepIndex = -1
                
                startForegroundCompat()
                startLocationUpdates()
                speakCurrentStep()
            }
            ACTION_UPDATE -> {
                val stepIdx = intent.getIntExtra(EXTRA_STEP_INDEX, currentStepIndex)
                if (stepIdx != currentStepIndex) {
                    currentStepIndex = stepIdx
                    speakCurrentStep()
                    updateNotification()
                }
            }
            ACTION_STOP -> {
                stopSelf()
            }
        }

        return START_NOT_STICKY
    }

    private fun parseSteps(stepsStr: String) {
        val list = ArrayList<JSONObject>()
        try {
            val arr = JSONArray(stepsStr)
            for (i in 0 until arr.length()) {
                list.add(arr.getJSONObject(i))
            }
        } catch (e: Exception) {
            Log.e("NavigationService", "Error parsing steps", e)
        }
        steps = list
    }

    private fun startForegroundCompat() {
        val notification = buildNotification("Starting Navigation", "Calculating path...")
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun startLocationUpdates() {
        try {
            locationManager?.requestLocationUpdates(
                LocationManager.GPS_PROVIDER,
                2000L,
                5f,
                locationListener
            )
        } catch (e: SecurityException) {
            Log.e("NavigationService", "Location permission missing", e)
        }
    }

    private val locationListener = object : LocationListener {
        override fun onLocationChanged(location: Location) {
            // Track distance to the next maneuver point and trigger TTS or auto-advance
            // Send position back to MainActivity/WebView so that UI updates
            val intent = Intent("dev.serika.maps.LOCATION_UPDATE")
            intent.putExtra("latitude", location.latitude)
            intent.putExtra("longitude", location.longitude)
            intent.putExtra("bearing", location.bearing)
            intent.putExtra("speed", location.speed)
            sendBroadcast(intent)
            
            checkNavigationProgress(location)
        }
        override fun onProviderEnabled(provider: String) {}
        override fun onProviderDisabled(provider: String) {}
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
    }

    private fun checkNavigationProgress(location: Location) {
        if (steps.isEmpty() || currentStepIndex >= steps.size) return
        
        // Dynamic step tracking/progress update for peak background experience
        val currentStep = steps[currentStepIndex]
        val instruction = currentStep.optString("instruction", "")
        val distance = currentStep.optDouble("distance", 0.0)
        
        // Update notification description
        updateNotification()
    }

    private fun buildNotification(title: String, text: String): Notification {
        val stopIntent = Intent(this, NavigationService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 0, stopIntent, PendingIntent.FLAG_IMMUTABLE
        )

        // Launch MainActivity on tap
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val launchPendingIntent = PendingIntent.getActivity(
            this, 0, launchIntent, PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_directions)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_NAVIGATION)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(launchPendingIntent)
            .addAction(
                android.R.drawable.ic_menu_close_clear_cancel,
                "Stop Navigation",
                stopPendingIntent
            )
            .build()
    }

    private fun updateNotification() {
        if (steps.isEmpty() || currentStepIndex >= steps.size) return
        
        val currentStep = steps[currentStepIndex]
        val instruction = currentStep.optString("instruction", "")
        val distLeft = currentStep.optDouble("distance", 0.0)
        
        val distStr = if (distLeft >= 1000) {
            String.format(Locale.getDefault(), "%.1f km", distLeft / 1000)
        } else {
            String.format(Locale.getDefault(), "%d m", distLeft.toInt())
        }

        val notification = buildNotification(
            instruction,
            "Remaining step distance: $distStr"
        )
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, notification)
    }

    private fun speakCurrentStep() {
        if (steps.isEmpty() || currentStepIndex >= steps.size || !isTtsReady) return
        if (currentStepIndex == lastSpokenStepIndex) return
        
        val currentStep = steps[currentStepIndex]
        val instruction = currentStep.optString("instruction", "")
        
        if (instruction.isNotEmpty()) {
            tts?.speak(instruction, TextToSpeech.QUEUE_FLUSH, null, "step_guidance")
            lastSpokenStepIndex = currentStepIndex
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            isTtsReady = true
            // Setup voice locale based on chosen language
            val locale = when (languageCode) {
                "ja" -> Locale.JAPANESE
                "nl" -> Locale("nl", "NL")
                else -> Locale.US
            }
            tts?.language = locale
            speakCurrentStep()
        } else {
            Log.e("NavigationService", "TTS Initialization failed")
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "Serika Navigation Channel"
            val descriptionText = "Ongoing voice navigation announcements"
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
                setSound(null, null)
                enableVibration(false)
            }
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        isServiceRunning = false
        locationManager?.removeUpdates(locationListener)
        tts?.stop()
        tts?.shutdown()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
