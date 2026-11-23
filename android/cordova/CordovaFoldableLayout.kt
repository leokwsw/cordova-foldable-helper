package com.leokwsw.foldable

import org.apache.cordova.CallbackContext
import org.apache.cordova.CordovaPlugin
import org.apache.cordova.PluginResult
import org.json.JSONArray
import org.json.JSONObject

class CordovaFoldableLayout : CordovaPlugin() {
    private val watchers = mutableMapOf<String, CallbackContext>()
    private var monitor: FoldMonitor? = null
    private var paused = false

    override fun execute(action: String, args: JSONArray, callback: CallbackContext): Boolean {
        if (action != "watch" && action != "unwatch") return false
        val id = args.getString(0)
        cordova.activity.runOnUiThread {
            if (action == "watch") {
                val monitor = monitor ?: FoldMonitor(cordova.activity, webView.view)
                    .also { monitor = it }
                val start = watchers.isEmpty() && !paused
                watchers[id] = callback
                if (start) {
                    monitor.start(::emit)
                } else if (paused || monitor.isReady) {
                    send(callback, monitor.snapshot())
                }
            } else {
                watchers.remove(id)?.sendPluginResult(PluginResult(PluginResult.Status.NO_RESULT))
                if (watchers.isEmpty()) monitor?.stop()
                callback.success()
            }
        }
        return true
    }

    private fun emit(state: JSONObject) {
        watchers.values.forEach { send(it, state) }
    }

    private fun send(callback: CallbackContext, state: JSONObject) {
        val result = PluginResult(PluginResult.Status.OK, state)
        result.keepCallback = true
        callback.sendPluginResult(result)
    }

    override fun onPause(multitasking: Boolean) {
        paused = true
        monitor?.stop()
    }

    override fun onResume(multitasking: Boolean) {
        paused = false
        if (watchers.isNotEmpty()) monitor?.start(::emit)
    }

    override fun onReset() {
        cordova.activity.runOnUiThread {
            watchers.values.forEach { it.sendPluginResult(PluginResult(PluginResult.Status.NO_RESULT)) }
            watchers.clear()
            monitor?.stop()
        }
    }

    override fun onDestroy() = onReset()
}
