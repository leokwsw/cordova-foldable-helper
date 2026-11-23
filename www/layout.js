function avoidInsets(area, info, options = {}) {
    const { direction = 'ltr', avoidCamera = true, avoidFold = true } = options;
    const insets = { left: 0, top: 0, right: 0, bottom: 0 };
    const width = Math.max(0, area.right - area.left);
    const height = Math.max(0, area.bottom - area.top);
    if (width === 0 || height === 0) return insets;

    if (avoidCamera) {
        for (const region of info.occlusions) {
            if (!region.isActive || region.left >= area.right || region.right <= area.left ||
                region.top >= area.bottom || region.bottom <= area.top) continue;
            if (region.top + region.bottom < area.top + area.bottom) {
                insets.top = Math.max(insets.top, region.bottom - area.top);
            } else {
                insets.bottom = Math.max(insets.bottom, area.bottom - region.top);
            }
        }
    }

    const fold = info.fold;
    // A separating fold can have zero width or height.
    if (avoidFold && fold && fold.isActive &&
        fold.left < area.right && fold.right > area.left &&
        fold.top < area.bottom && fold.bottom > area.top) {
        if (!info.isVerticalHinge) {
            insets.bottom = Math.max(insets.bottom, area.bottom - fold.top);
        } else if (direction === 'rtl') {
            insets.left = Math.max(insets.left, fold.right - area.left);
        } else {
            insets.right = Math.max(insets.right, area.right - fold.left);
        }
    }

    insets.left = Math.min(insets.left, width);
    insets.right = Math.min(insets.right, width - insets.left);
    insets.top = Math.min(insets.top, height);
    insets.bottom = Math.min(insets.bottom, height - insets.top);
    return insets;
}

function isPhoneLayout(shortestSide, info, platform) {
    if (platform === 'ios' && info.isFoldableDevice) return info.state === 'folded';
    return shortestSide < 600;
}

function createAPI(subscribe) {
    const session = Math.random().toString(36).slice(2);
    let nextId = 0;
    async function watch(listener, onError) {
        return subscribe(`${session}-${++nextId}`, listener, onError);
    }

    function getState() {
        return readState(0, false);
    }

    function waitForSettle(quietWindow = 400) {
        return readState(quietWindow, true);
    }

    function readState(quietWindow, settle) {
        let timer;
        let pending = true;
        return new Promise((resolve, reject) => {
            async function finish(value, failed = false) {
                if (!pending) return;
                pending = false;
                clearTimeout(timer);
                try {
                    await (await subscription).remove();
                    if (failed) reject(value);
                    else resolve(value);
                } catch (error) {
                    reject(failed ? value : error);
                }
            }

            const subscription = Promise.resolve().then(() => watch(state => {
                if (!pending) return;
                clearTimeout(timer);
                if (settle) timer = setTimeout(() => finish(state), quietWindow);
                else finish(state);
            }, error => finish(error, true)));
            subscription.catch(error => finish(error, true));
        });
    }

    return { watch, getState, waitForSettle, avoidInsets, isPhoneLayout };
}

module.exports = { createAPI, avoidInsets };
