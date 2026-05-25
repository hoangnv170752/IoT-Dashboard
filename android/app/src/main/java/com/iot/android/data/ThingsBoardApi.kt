package com.iot.android.data

import com.iot.android.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

/**
 * Thin REST client for the ThingsBoard tenant endpoints we use.
 * Mirrors the shape of ui/lib/auth.ts and ui/lib/device.ts so the two
 * clients stay easy to compare.
 */
object ThingsBoardApi {

    private val baseUrl: String = BuildConfig.API_BASE_URL.trimEnd('/')

    suspend fun login(username: String, password: String): AuthTokens =
        withContext(Dispatchers.IO) {
            val body = JSONObject()
                .put("username", username)
                .put("password", password)
                .toString()

            val json = post("/auth/login", body, token = null)
            AuthTokens(
                token = json.getString("token"),
                refreshToken = json.getString("refreshToken"),
            )
        }

    suspend fun fetchDeviceInfos(
        token: String,
        pageSize: Int = 50,
        page: Int = 0,
    ): List<DeviceInfo> = withContext(Dispatchers.IO) {
        val path = "/tenant/deviceInfos?pageSize=$pageSize&page=$page"
        val json = get(path, token)
        val data = json.getJSONArray("data")
        List(data.length()) { idx ->
            val item = data.getJSONObject(idx)
            DeviceInfo(
                id = item.getJSONObject("id").getString("id"),
                name = item.getString("name"),
                type = item.optString("type", ""),
                label = item.optString("label").takeUnless { it.isNullOrBlank() || it == "null" },
                deviceProfileName = item.optString("deviceProfileName", ""),
                active = item.optBoolean("active", false),
            )
        }
    }

    suspend fun fetchDeviceCredentials(
        token: String,
        deviceId: String,
    ): DeviceCredentials = withContext(Dispatchers.IO) {
        val json = get("/device/$deviceId/credentials", token)
        DeviceCredentials(
            deviceId = json.getJSONObject("deviceId").getString("id"),
            credentialsType = json.getString("credentialsType"),
            credentialsId = json.optString("credentialsId").takeUnless { it.isNullOrBlank() || it == "null" },
            credentialsValue = json.optString("credentialsValue").takeUnless { it.isNullOrBlank() || it == "null" },
        )
    }

    private fun get(path: String, token: String?): JSONObject =
        request("GET", path, token = token, body = null)

    private fun post(path: String, body: String, token: String?): JSONObject =
        request("POST", path, token = token, body = body)

    private fun request(
        method: String,
        path: String,
        token: String?,
        body: String?,
    ): JSONObject {
        val conn = (URL(baseUrl + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15_000
            readTimeout = 15_000
            setRequestProperty("Accept", "application/json")
            if (body != null) {
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
            }
            if (token != null) {
                setRequestProperty("X-Authorization", "Bearer $token")
            }
        }
        try {
            if (body != null) {
                conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.let {
                BufferedReader(InputStreamReader(it, Charsets.UTF_8)).use(BufferedReader::readText)
            }.orEmpty()
            if (code !in 200..299) {
                throw ApiException(code, text.ifBlank { "HTTP $code" })
            }
            return JSONObject(text)
        } finally {
            conn.disconnect()
        }
    }
}

class ApiException(val statusCode: Int, message: String) : RuntimeException(message)
