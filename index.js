const { createAPI, avoidInsets } = require('./www/layout');

let native;
async function subscribe(id, listener, onError) {
    if (typeof window !== 'undefined' && window.cordova && window.FoldableLayout) {
        return window.FoldableLayout.watch(listener, onError);
    }

    // The optional peer is only used by Capacitor applications.
    if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform()) {
        native ??= require('@capacitor/core').registerPlugin('FoldableLayout');
        let active = true;
        let received = false;
        const connection = await native.addListener('change', state => {
            if (!active) return;
            received = true;
            listener(state);
        });
        try {
            const initial = await native.start({ id });
            if (!received && initial?.state) listener(initial);
        } catch (error) {
            active = false;
            await Promise.allSettled([connection.remove(), native.stop({ id })]);
            throw error;
        }

        let removal;
        return {
            remove() {
                active = false;
                removal ??= Promise.all([connection.remove(), native.stop({ id })]).then(() => undefined);
                return removal;
            }
        };
    }

    const viewport = typeof window === 'undefined' ? undefined : window;
    const read = () => ({
        state: 'notFoldable',
        isFoldableDevice: false,
        hingeAngle: null,
        isLandscape: viewport ? viewport.innerWidth > viewport.innerHeight : false,
        isVerticalHinge: false,
        fold: null,
        occlusions: []
    });

    let previous = read();
    listener(previous);
    function resize() {
        const state = read();
        if (state.isLandscape === previous.isLandscape) return;
        previous = state;
        listener(state);
    }
    viewport?.addEventListener('resize', resize);
    return { async remove() { viewport?.removeEventListener('resize', resize); } };
}

exports.FoldableLayout = createAPI(subscribe);
exports.avoidInsets = avoidInsets;
