import Capacitor
import UIKit

@objc(FoldableLayoutPlugin)
public final class FoldableLayoutPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FoldableLayoutPlugin"
    public let jsName = "FoldableLayout"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private var watchers: Set<String> = []
    private var monitor: FoldMonitor?

    @objc public func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            guard let id = call.getString("id"), let view = self.bridge?.webView else {
                call.reject("Fold watcher requires an ID and an attached WebView")
                return
            }
            let monitor = self.monitor ?? FoldMonitor(view: view)
            self.monitor = monitor
            if self.watchers.insert(id).inserted && self.watchers.count == 1 {
                monitor.start { [weak self] state in self?.notifyListeners("change", data: state) }
            }
            if monitor.isReady { call.resolve(monitor.snapshot()) }
            else { call.resolve() }
        }
    }

    @objc public func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            if let id = call.getString("id"), self.watchers.remove(id) != nil, self.watchers.isEmpty {
                self.monitor?.stop()
                self.monitor = nil
            }
            call.resolve()
        }
    }

    deinit {
        let monitor = monitor
        DispatchQueue.main.async { monitor?.stop() }
    }
}
