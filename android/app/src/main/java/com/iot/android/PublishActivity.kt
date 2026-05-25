package com.iot.android

import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.iot.android.data.DeviceInfo
import com.iot.android.data.MqttCredentials
import com.iot.android.data.MqttPublisher
import com.iot.android.data.ThingsBoardApi
import com.iot.android.data.TokenStore
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.coroutines.coroutineContext
import kotlin.random.Random

class PublishActivity : AppCompatActivity() {

    private lateinit var device: DeviceInfo
    private var mqttCredentials: MqttCredentials? = null

    private lateinit var textDeviceName: TextView
    private lateinit var textBroker: TextView
    private lateinit var textCredentials: TextView
    private lateinit var textLog: TextView
    private lateinit var buttonPublish: Button
    private lateinit var editInterval: EditText
    private lateinit var progress: ProgressBar

    private val timeFmt = SimpleDateFormat("HH:mm:ss", Locale.US)

    private var streamJob: Job? = null
    private var session: MqttPublisher.Session? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_publish)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        @Suppress("DEPRECATION")
        device = (intent.getSerializableExtra(EXTRA_DEVICE) as? DeviceInfo)
            ?: run { finish(); return }

        textDeviceName = findViewById(R.id.textDeviceName)
        textBroker = findViewById(R.id.textBroker)
        textCredentials = findViewById(R.id.textCredentials)
        textLog = findViewById(R.id.textLog)
        buttonPublish = findViewById(R.id.buttonPublish)
        editInterval = findViewById(R.id.editInterval)
        progress = findViewById(R.id.progress)

        textDeviceName.text = device.name
        textBroker.text = "${MqttPublisher.brokerUri}  ·  topic ${MqttPublisher.TELEMETRY_TOPIC}"

        buttonPublish.isEnabled = false
        buttonPublish.setOnClickListener { toggleStream() }

        loadCredentials()
    }

    override fun onSupportNavigateUp(): Boolean { finish(); return true }

    override fun onDestroy() {
        super.onDestroy()
        streamJob?.cancel()
        streamJob = null
        session?.close()
        session = null
    }

    private fun loadCredentials() {
        val token = TokenStore.getToken(this)
        if (token == null) {
            log("No auth token — please login again.")
            return
        }
        progress.visibility = View.VISIBLE
        log(getString(R.string.msg_loading_credentials))
        lifecycleScope.launch {
            runCatching { ThingsBoardApi.fetchDeviceCredentials(token, device.id) }
                .onSuccess { creds ->
                    progress.visibility = View.GONE
                    val mqtt = creds.asMqttBasic()
                    if (mqtt == null) {
                        textCredentials.text = "Credentials type: ${creds.credentialsType}\n" +
                            "(Only MQTT_BASIC is supported by this screen.)"
                        log("Device uses ${creds.credentialsType} — cannot publish via MQTT_BASIC.")
                        return@onSuccess
                    }
                    mqttCredentials = mqtt
                    textCredentials.text = buildString {
                        appendLine("clientId : ${mqtt.clientId}")
                        appendLine("username : ${mqtt.userName}")
                        append("password : ${mask(mqtt.password)}")
                    }
                    buttonPublish.isEnabled = true
                    log("Credentials loaded. Ready to publish.")
                }
                .onFailure { error ->
                    progress.visibility = View.GONE
                    log("Failed to load credentials: ${error.message ?: "unknown error"}")
                }
        }
    }

    private fun toggleStream() {
        if (streamJob != null) stopStream() else startStream()
    }

    private fun startStream() {
        val mqtt = mqttCredentials ?: return
        val intervalSec = editInterval.text.toString().toIntOrNull()?.coerceAtLeast(1) ?: 3
        val intervalMs = intervalSec * 1000L

        setStreaming(true)
        editInterval.isEnabled = false

        streamJob = lifecycleScope.launch {
            try {
                log("Connecting ${MqttPublisher.brokerUri} …")
                val s = MqttPublisher.openSession(mqtt)
                session = s
                log("✓ Connected — streaming every ${intervalSec}s")
                var seq = 0
                while (coroutineContext.isActive) {
                    val payload = JSONObject()
                        .put("temperature", Random.nextInt(20, 36))
                        .put("humidity", Random.nextInt(40, 91))
                        .toString()
                    runCatching { s.publish(payload) }
                        .onSuccess {
                            seq += 1
                            log("✓ #$seq $payload")
                        }
                        .onFailure { e ->
                            log("✗ publish: ${e.message ?: "unknown error"}")
                        }
                    delay(intervalMs)
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                log("Stream error: ${e.message ?: "unknown error"}")
            } finally {
                session?.close()
                session = null
                runOnUiThread {
                    setStreaming(false)
                    editInterval.isEnabled = true
                }
            }
        }
    }

    private fun stopStream() {
        log("Stopping stream …")
        streamJob?.cancel()
        streamJob = null
    }

    private fun setStreaming(streaming: Boolean) {
        if (streaming) {
            buttonPublish.setText(R.string.action_stop_stream)
            progress.visibility = View.VISIBLE
        } else {
            buttonPublish.setText(R.string.action_start_stream)
            progress.visibility = View.GONE
        }
        buttonPublish.isEnabled = mqttCredentials != null
    }

    private fun log(line: String) {
        val ts = timeFmt.format(Date())
        textLog.text = buildString {
            append("[$ts] ")
            append(line)
            if (textLog.text.isNotEmpty()) {
                append('\n')
                append(textLog.text)
            }
        }
    }

    private fun mask(value: String): String =
        if (value.length <= 4) "*".repeat(value.length)
        else value.take(2) + "*".repeat(value.length - 4) + value.takeLast(2)

    companion object {
        const val EXTRA_DEVICE = "extra_device"
    }
}
