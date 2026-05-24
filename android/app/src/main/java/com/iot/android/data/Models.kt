package com.iot.android.data

import java.io.Serializable

data class AuthTokens(
    val token: String,
    val refreshToken: String,
)

data class DeviceInfo(
    val id: String,
    val name: String,
    val type: String,
    val label: String?,
    val deviceProfileName: String,
    val active: Boolean,
) : Serializable

data class MqttCredentials(
    val clientId: String,
    val userName: String,
    val password: String,
) : Serializable

data class DeviceCredentials(
    val deviceId: String,
    val credentialsType: String,
    val credentialsId: String?,
    val credentialsValue: String?,
) {
    fun asMqttBasic(): MqttCredentials? {
        if (credentialsType != "MQTT_BASIC" || credentialsValue == null) return null
        return runCatching {
            val obj = org.json.JSONObject(credentialsValue)
            MqttCredentials(
                clientId = obj.optString("clientId", ""),
                userName = obj.optString("userName", ""),
                password = obj.optString("password", ""),
            )
        }.getOrNull()
    }
}
