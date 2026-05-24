package com.iot.android.data

import com.iot.android.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.eclipse.paho.client.mqttv3.MqttClient
import org.eclipse.paho.client.mqttv3.MqttConnectOptions
import org.eclipse.paho.client.mqttv3.MqttMessage
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence
import java.net.URL

/**
 * Publishes a single MQTT message to ThingsBoard using MQTT_BASIC credentials.
 * Mirrors the shell example:
 *   mosquitto_pub -d -q 1 -h $HOST -p 1883 -t v2/t \
 *     -i $CLIENT_ID -u $USERNAME -P $PASSWORD -m '<json>'
 */
object MqttPublisher {

    /** Derived from BE_URL host — ThingsBoard's MQTT broker shares the API hostname. */
    val brokerHost: String = runCatching { URL(BuildConfig.API_BASE_URL).host }
        .getOrDefault("demo.thingsboard.io")

    const val BROKER_PORT: Int = 1883
    const val TELEMETRY_TOPIC: String = "v2/t"

    val brokerUri: String get() = "tcp://$brokerHost:$BROKER_PORT"

    suspend fun publishTelemetry(
        credentials: MqttCredentials,
        payloadJson: String,
        topic: String = TELEMETRY_TOPIC,
        qos: Int = 1,
    ): Unit = withContext(Dispatchers.IO) {
        openSession(credentials).use { it.publish(payloadJson, topic, qos) }
    }

    /** Open a persistent MQTT connection. Caller owns the [Session] and must close it. */
    suspend fun openSession(credentials: MqttCredentials): Session =
        withContext(Dispatchers.IO) {
            val client = MqttClient(brokerUri, credentials.clientId, MemoryPersistence())
            val options = MqttConnectOptions().apply {
                isCleanSession = true
                userName = credentials.userName
                password = credentials.password.toCharArray()
                connectionTimeout = 15
                keepAliveInterval = 30
            }
            client.connect(options)
            Session(client)
        }

    /** Persistent MQTT publish handle. Re-use across many messages. */
    class Session internal constructor(private val client: MqttClient) : AutoCloseable {

        val isConnected: Boolean get() = client.isConnected

        suspend fun publish(
            payloadJson: String,
            topic: String = TELEMETRY_TOPIC,
            qos: Int = 1,
        ): Unit = withContext(Dispatchers.IO) {
            val message = MqttMessage(payloadJson.toByteArray(Charsets.UTF_8)).apply {
                this.qos = qos
                isRetained = false
            }
            client.publish(topic, message)
        }

        override fun close() {
            runCatching { if (client.isConnected) client.disconnect() }
            runCatching { client.close() }
        }
    }
}
