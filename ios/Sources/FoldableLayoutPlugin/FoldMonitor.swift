import UIKit

final class FoldMonitor {
    private weak var view: UIView?
    private var listener: (([String: Any]) -> Void)?
    private var probe: FoldLayoutProbe?
    private var interaction: UIInteraction?
    private var hinge: AnyObject?
    private var previous: NSDictionary?

    var isReady: Bool { previous != nil }

    init(view: UIView) {
        self.view = view
    }

    func start(_ listener: @escaping ([String: Any]) -> Void) {
        guard let view, self.listener == nil else { return }
        self.listener = listener
        let probe = FoldLayoutProbe(frame: view.bounds)
        probe.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        probe.isUserInteractionEnabled = false
        probe.onChange = { [weak self] in self?.emit() }
        view.addSubview(probe)
        self.probe = probe

        if #available(iOS 27.1, *) {
            let interaction = UIHingeInteraction { [weak self] _, update in
                self?.hinge = update.hinge
                self?.emit()
            }
            self.interaction = interaction
            probe.addInteraction(interaction)
        }

        probe.setNeedsUpdateConstraints()
        // Allow the first layout pass to populate the hardware regions.
        DispatchQueue.main.async { [weak self, weak probe] in
            guard let self, let probe, self.probe === probe else { return }
            probe.updateConstraintsIfNeeded()
            self.emit()
        }
    }

    func stop() {
        listener = nil
        if let interaction { probe?.removeInteraction(interaction) }
        probe?.removeFromSuperview()
        probe = nil
        interaction = nil
        hinge = nil
        previous = nil
    }

    func snapshot() -> [String: Any] {
        let bounds = view?.window?.rootViewController?.viewIfLoaded?.bounds ?? view?.bounds ?? .zero
        var result: [String: Any] = [
            "state": "notFoldable",
            "isFoldableDevice": false,
            "hingeAngle": NSNull(),
            "isLandscape": bounds.width > bounds.height,
            "isVerticalHinge": false,
            "fold": NSNull(),
            "occlusions": [[String: Any]]()
        ]

        if #available(iOS 27.1, *) {
            if let hinge = hinge as? UIHinge {
                let angle = hinge.angle * 180 / .pi
                result["isFoldableDevice"] = true
                if angle.isFinite { result["hingeAngle"] = angle }
                switch hinge.status {
                case .closed: result["state"] = "folded"
                case .fullyOpen: result["state"] = "unfolded"
                case .partiallyOpen: result["state"] = "halfOpened"
                default:
                    result["state"] = angle.isFinite
                        ? (angle <= 0 ? "folded" : angle >= 175 ? "unfolded" : "halfOpened")
                        : "unknown"
                }
            }
            if let region = probe?.division {
                result["isFoldableDevice"] = true
                if hinge == nil { result["state"] = "unknown" }
                result["isVerticalHinge"] = region.frame.height > region.frame.width
                result["fold"] = region.payload
            }
            result["occlusions"] = probe?.occlusions.map(\.payload) ?? []
        }
        return result
    }

    private func emit() {
        guard let listener else { return }
        let state = snapshot()
        if previous?.isEqual(to: state) == true { return }
        previous = state as NSDictionary
        listener(state)
    }
}

private final class FoldLayoutProbe: UIView {
    struct Region {
        let frame: CGRect
        let isActive: Bool

        var payload: [String: Any] {
            [
                "left": frame.minX, "top": frame.minY,
                "right": frame.maxX, "bottom": frame.maxY,
                "isActive": isActive
            ]
        }
    }

    var onChange: (() -> Void)?
    private(set) var division: Region?
    private(set) var occlusions: [Region] = []

    override class var requiresConstraintBasedLayout: Bool { true }

    override func updateConstraints() {
        if #available(iOS 27.1, *) {
            division = reservedRegions(kind: .division, options: .includeInactive)
                .first.map { Region(frame: $0.frame, isActive: $0.isActive) }
            occlusions = reservedRegions(kind: .occlusion, options: .includeInactive)
                .map { Region(frame: $0.frame, isActive: $0.isActive) }
        }
        super.updateConstraints()
        scheduleChange()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        scheduleChange()
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        setNeedsUpdateConstraints()
        scheduleChange()
    }

    private func scheduleChange() {
        DispatchQueue.main.async { [weak self] in self?.onChange?() }
    }
}
