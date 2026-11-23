package com.leokwsw.foldable

import android.app.Activity
import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.view.View
import android.view.ViewTreeObserver
import androidx.core.content.ContextCompat
import androidx.core.util.Consumer
import androidx.window.java.layout.WindowInfoTrackerCallbackAdapter
import androidx.window.layout.FoldingFeature
import androidx.window.layout.WindowInfoTracker
import androidx.window.layout.WindowLayoutInfo
import androidx.window.layout.WindowMetricsCalculator
import org.json.JSONArray
import org.json.JSONObject

internal class FoldMonitor(private val activity: Activity, private val webView: View) : SensorEventListener {
    private val sensors = activity.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val hinge = sensors.getDefaultSensor(Sensor.TYPE_HINGE_ANGLE)
    private val tracker = WindowInfoTrackerCallbackAdapter(WindowInfoTracker.getOrCreate(activity))
    private val layoutCallback = Consumer<WindowLayoutInfo>(::onWindowLayout)
    private val viewCallback = ViewTreeObserver.OnGlobalLayoutListener(::emit)
    private var listener: ((JSONObject) -> Unit)? = null
    private var fold: FoldingFeature? = null
    private var angle: Float? = null
    private var previous: String? = null

    var isReady = false
        private set

    fun start(listener: (JSONObject) -> Unit) {
        if (this.listener != null) return
        this.listener = listener
        webView.viewTreeObserver.addOnGlobalLayoutListener(viewCallback)
        hinge?.let { sensors.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL) }
        tracker.addWindowLayoutInfoListener(activity, ContextCompat.getMainExecutor(activity), layoutCallback)
    }

    fun stop() {
        listener = null
        tracker.removeWindowLayoutInfoListener(layoutCallback)
        sensors.unregisterListener(this)
        val observer = webView.viewTreeObserver
        if (observer.isAlive) observer.removeOnGlobalLayoutListener(viewCallback)
        previous = null
        isReady = false
        fold = null
        angle = null
    }

    fun snapshot(): JSONObject {
        val window = WindowMetricsCalculator.getOrCreate().computeCurrentWindowMetrics(activity).bounds
        val feature = fold
        val angle = angle
        val foldable = feature != null || hinge != null ||
            activity.packageManager.hasSystemFeature("android.hardware.sensor.hinge_angle")
        val state = when {
            angle != null && angle <= 0 -> "folded"
            angle != null && angle >= 175 -> "unfolded"
            angle != null || feature?.state == FoldingFeature.State.HALF_OPENED -> "halfOpened"
            feature != null -> "unfolded"
            foldable -> "unknown"
            else -> "notFoldable"
        }

        return JSONObject()
            .put("state", state)
            .put("isFoldableDevice", foldable)
            .put("hingeAngle", angle ?: JSONObject.NULL)
            .put("isLandscape", window.width() > window.height())
            .put("isVerticalHinge", feature?.orientation == FoldingFeature.Orientation.VERTICAL)
            .put("fold", feature?.let(::foldRegion) ?: JSONObject.NULL)
            .put("occlusions", JSONArray())
    }

    private fun foldRegion(feature: FoldingFeature): JSONObject {
        val bounds = feature.bounds
        val origin = IntArray(2)
        webView.getLocationInWindow(origin)
        val density = webView.resources.displayMetrics.density
        return JSONObject()
            .put("left", (bounds.left - origin[0]) / density)
            .put("top", (bounds.top - origin[1]) / density)
            .put("right", (bounds.right - origin[0]) / density)
            .put("bottom", (bounds.bottom - origin[1]) / density)
            .put("isActive", feature.isSeparating)
    }

    private fun onWindowLayout(info: WindowLayoutInfo) {
        if (listener == null) return
        isReady = true
        fold = info.displayFeatures.filterIsInstance<FoldingFeature>().firstOrNull()
        emit()
    }

    private fun emit() {
        val listener = listener ?: return
        if (!isReady) return
        val result = snapshot()
        val serialized = result.toString()
        if (serialized == previous) return
        previous = serialized
        listener(result)
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (listener == null) return
        angle = event.values.firstOrNull()?.takeIf { it.isFinite() } ?: return
        emit()
    }

    override fun onAccuracyChanged(sensor: Sensor, accuracy: Int) = Unit
}
