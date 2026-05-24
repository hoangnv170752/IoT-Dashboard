package com.iot.android

import android.content.Intent
import android.content.res.ColorStateList
import android.os.Bundle
import android.view.LayoutInflater
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.view.ViewGroup
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.iot.android.data.DeviceInfo
import com.iot.android.data.ThingsBoardApi
import com.iot.android.data.TokenStore
import kotlinx.coroutines.launch

class DeviceListActivity : AppCompatActivity() {

    private lateinit var recycler: RecyclerView
    private lateinit var progress: ProgressBar
    private lateinit var textStatus: TextView

    private val adapter = DeviceAdapter(::onDeviceClicked)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_device_list)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        recycler = findViewById(R.id.recyclerDevices)
        progress = findViewById(R.id.progress)
        textStatus = findViewById(R.id.textStatus)

        recycler.layoutManager = LinearLayoutManager(this)
        recycler.adapter = adapter

        loadDevices()
    }

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menu.add(0, MENU_REFRESH, 0, R.string.action_refresh)
            .setShowAsAction(MenuItem.SHOW_AS_ACTION_IF_ROOM)
        menu.add(0, MENU_LOGOUT, 1, R.string.action_logout)
            .setShowAsAction(MenuItem.SHOW_AS_ACTION_NEVER)
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean = when (item.itemId) {
        MENU_REFRESH -> { loadDevices(); true }
        MENU_LOGOUT -> { logout(); true }
        android.R.id.home -> { finish(); true }
        else -> super.onOptionsItemSelected(item)
    }

    private fun loadDevices() {
        val token = TokenStore.getToken(this)
        if (token == null) {
            logout()
            return
        }
        setBusy(true, getString(R.string.msg_loading_devices))
        lifecycleScope.launch {
            runCatching { ThingsBoardApi.fetchDeviceInfos(token) }
                .onSuccess { devices ->
                    adapter.submit(devices)
                    val msg = if (devices.isEmpty()) {
                        getString(R.string.msg_no_devices)
                    } else {
                        "Loaded ${devices.size} devices"
                    }
                    setBusy(false, msg)
                }
                .onFailure { error ->
                    setBusy(false, "Failed to load devices: ${error.message ?: "unknown error"}")
                }
        }
    }

    private fun onDeviceClicked(device: DeviceInfo) {
        val intent = Intent(this, PublishActivity::class.java).apply {
            putExtra(PublishActivity.EXTRA_DEVICE, device)
        }
        startActivity(intent)
    }

    private fun logout() {
        TokenStore.clear(this)
        startActivity(
            Intent(this, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK)
        )
        finish()
    }

    private fun setBusy(busy: Boolean, status: String?) {
        progress.visibility = if (busy) View.VISIBLE else View.GONE
        textStatus.text = status.orEmpty()
    }

    companion object {
        private const val MENU_REFRESH = 1
        private const val MENU_LOGOUT = 2
    }
}

private class DeviceAdapter(
    private val onClick: (DeviceInfo) -> Unit,
) : RecyclerView.Adapter<DeviceAdapter.VH>() {

    private val items = mutableListOf<DeviceInfo>()

    fun submit(newItems: List<DeviceInfo>) {
        items.clear()
        items.addAll(newItems)
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_device, parent, false)
        return VH(view)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        val device = items[position]
        val ctx = holder.itemView.context

        holder.name.text = device.name

        val labelPart = device.label?.takeIf { it.isNotBlank() }?.let { " · $it" }.orEmpty()
        holder.meta.text = "${device.deviceProfileName}$labelPart"

        val dotColor: Int
        val textColor: Int
        val bgColor: Int
        val statusText: Int
        if (device.active) {
            dotColor = ContextCompat.getColor(ctx, R.color.status_online)
            textColor = dotColor
            bgColor = ContextCompat.getColor(ctx, R.color.status_online_bg)
            statusText = R.string.status_online
        } else {
            dotColor = ContextCompat.getColor(ctx, R.color.status_offline)
            textColor = dotColor
            bgColor = ContextCompat.getColor(ctx, R.color.status_offline_bg)
            statusText = R.string.status_offline
        }
        holder.statusDot.backgroundTintList = ColorStateList.valueOf(dotColor)
        holder.statusText.setTextColor(textColor)
        holder.statusText.setText(statusText)
        ViewCompat.setBackgroundTintList(holder.badge, ColorStateList.valueOf(bgColor))

        holder.itemView.setOnClickListener { onClick(device) }
    }

    override fun getItemCount(): Int = items.size

    class VH(view: View) : RecyclerView.ViewHolder(view) {
        val name: TextView = view.findViewById(R.id.textName)
        val meta: TextView = view.findViewById(R.id.textMeta)
        val badge: View = view.findViewById(R.id.badgeStatus)
        val statusDot: View = view.findViewById(R.id.statusDot)
        val statusText: TextView = view.findViewById(R.id.textStatus)
    }
}
