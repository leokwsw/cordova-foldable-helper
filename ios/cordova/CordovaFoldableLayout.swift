import Cordova
import UIKit

@objc(CordovaFoldableLayout)
final class CordovaFoldableLayout: CDVPlugin {
    private var watchers: [String: String] = [:]
    private var monitor: FoldMonitor?

    @objc(watch:)
    func watch(_ command: CDVInvokedUrlCommand) {
        guard let id = command.argument(at: 0) as? String, let view = webView else {
            commandDelegate.send(CDVPluginResult(status: .error), callbackId: command.callbackId)
            return
        }
        let monitor = self.monitor ?? FoldMonitor(view: view)
        self.monitor = monitor
        let start = watchers.isEmpty
        watchers[id] = command.callbackId
        if start {
            monitor.start { [weak self] state in
                guard let self else { return }
                for callback in self.watchers.values { self.send(state, to: callback) }
            }
        } else if monitor.isReady {
            send(monitor.snapshot(), to: command.callbackId)
        }
    }

    @objc(unwatch:)
    func unwatch(_ command: CDVInvokedUrlCommand) {
        if let id = command.argument(at: 0) as? String, let callback = watchers.removeValue(forKey: id) {
            commandDelegate.send(CDVPluginResult(status: .noResult), callbackId: callback)
        }
        if watchers.isEmpty {
            monitor?.stop()
            monitor = nil
        }
        commandDelegate.send(CDVPluginResult(status: .ok), callbackId: command.callbackId)
    }

    override func onReset() {
        for callback in watchers.values {
            commandDelegate.send(CDVPluginResult(status: .noResult), callbackId: callback)
        }
        watchers.removeAll()
        monitor?.stop()
        monitor = nil
    }

    override func dispose() {
        watchers.removeAll()
        monitor?.stop()
        monitor = nil
        super.dispose()
    }

    private func send(_ state: [String: Any], to callback: String) {
        let result = CDVPluginResult(status: .ok, messageAs: state)
        result.setKeepCallbackAs(true)
        commandDelegate.send(result, callbackId: callback)
    }
}
