package com.iot.android

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.iot.android.data.ThingsBoardApi
import com.iot.android.data.TokenStore
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var editUsername: EditText
    private lateinit var editPassword: EditText
    private lateinit var buttonLogin: Button
    private lateinit var progress: ProgressBar
    private lateinit var textStatus: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        editUsername = findViewById(R.id.editUsername)
        editPassword = findViewById(R.id.editPassword)
        buttonLogin = findViewById(R.id.buttonLogin)
        progress = findViewById(R.id.progress)
        textStatus = findViewById(R.id.textStatus)

        findViewById<TextView>(R.id.textBaseUrl).text = BuildConfig.API_BASE_URL

        buttonLogin.setOnClickListener { performLogin() }
    }

    private fun performLogin() {
        val username = editUsername.text.toString().trim()
        val password = editPassword.text.toString()
        if (username.isEmpty() || password.isEmpty()) {
            textStatus.text = "Username and password are required"
            return
        }

        setBusy(true, getString(R.string.msg_logging_in))

        lifecycleScope.launch {
            runCatching { ThingsBoardApi.login(username, password) }
                .onSuccess { tokens ->
                    TokenStore.save(this@MainActivity, tokens)
                    setBusy(false, null)
                    startActivity(Intent(this@MainActivity, DeviceListActivity::class.java))
                }
                .onFailure { error ->
                    setBusy(false, "Login failed: ${error.message ?: "unknown error"}")
                }
        }
    }

    private fun setBusy(busy: Boolean, status: String?) {
        buttonLogin.isEnabled = !busy
        progress.visibility = if (busy) View.VISIBLE else View.GONE
        textStatus.text = status.orEmpty()
    }
}
