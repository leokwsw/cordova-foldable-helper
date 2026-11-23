package com.leokwsw.foldable

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "FoldableLayout")
class FoldableLayoutPlugin : Plugin() {
    private val watchers = mutableSetOf<String>()
    private var monitor: FoldMonitor? = null
    private var paused = false

    @PluginMethod
    fun start(call: PluginCall) {
        activity.runOnUiThread {
            val id = call.getString("id")
            if (id == null) {
                call.reject("Fold watcher requires an ID")
                return@runOnUiThread
            }
            val monitor = monitor()
            if (watchers.add(id) && watchers.size == 1 && !paused) startMonitor()
            if (paused || monitor.isReady) {
                call.resolve(JSObject.fromJSONObject(monitor.snapshot()))
            } else {
                call.resolve()
            }
        }
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        activity.runOnUiThread {
            val id = call.getString("id")
            if (id != null && watchers.remove(id) && watchers.isEmpty()) monitor?.stop()
            call.resolve()
        }
    }

    private fun monitor(): FoldMonitor =
        monitor ?: FoldMonitor(activity, bridge.webView).also { monitor = it }

    private fun startMonitor() {
        monitor().start { state -> notifyListeners("change", JSObject.fromJSONObject(state)) }
    }

    override fun handleOnPause() {
        paused = true
        monitor?.stop()
    }

    override fun handleOnResume() {
        paused = false
        if (watchers.isNotEmpty()) startMonitor()
    }

    override fun handleOnDestroy() {
        watchers.clear()
        monitor?.stop()
    }
}
