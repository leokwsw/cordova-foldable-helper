const assert = require('node:assert/strict');
const { test } = require('node:test');
const { FoldableLayout, avoidInsets } = require('..');
const { createAPI } = require('../www/layout');

const area = { left: 0, top: 0, right: 800, bottom: 600 };
const vertical = { left: 400, top: 0, right: 400, bottom: 600, isActive: true };
const empty = { isVerticalHinge: true, fold: null, occlusions: [] };

test('keeps content on the start side of a zero-width separating hinge', () => {
    const state = { ...empty, fold: vertical };
    assert.deepEqual(avoidInsets(area, state), { left: 0, top: 0, right: 400, bottom: 0 });
    assert.deepEqual(avoidInsets(area, state, { direction: 'rtl' }), {
        left: 400, top: 0, right: 0, bottom: 0
    });
    assert.deepEqual(avoidInsets({ ...area, left: 400 }, state), {
        left: 0, top: 0, right: 0, bottom: 0
    });
});

test('keeps content above a horizontal fold and away from active cameras', () => {
    const state = {
        isVerticalHinge: false,
        fold: { left: 0, top: 300, right: 800, bottom: 300, isActive: true },
        occlusions: [
            { left: 300, top: 0, right: 500, bottom: 30, isActive: true },
            { left: 300, top: 500, right: 500, bottom: 600, isActive: false }
        ]
    };
    assert.deepEqual(avoidInsets(area, state), { left: 0, top: 30, right: 0, bottom: 300 });
    assert.deepEqual(avoidInsets(area, state, { avoidFold: false, avoidCamera: false }), {
        left: 0, top: 0, right: 0, bottom: 0
    });
    assert.equal(avoidInsets(area, {
        ...empty, occlusions: [{ ...state.occlusions[1], isActive: true }]
    }).bottom, 100);
});

test('getState releases subscriptions even when the transport emits synchronously', async () => {
    let removed = 0;
    const api = createAPI((_id, emit) => {
        emit({ state: 'folded' });
        return { async remove() { removed++; } };
    });

    assert.deepEqual(await api.getState(), { state: 'folded' });
    assert.equal(removed, 1);
});

test('waitForSettle reports the latest state and releases the subscription', async () => {
    let removed = false;
    let emit;
    const api = createAPI((_id, listener) => {
        emit = listener;
        emit({ state: 'halfOpened' });
        return { async remove() { removed = true; } };
    });

    const settling = api.waitForSettle(5);
    await Promise.resolve();
    emit({ state: 'unfolded' });
    assert.deepEqual(await settling, { state: 'unfolded' });
    assert.equal(removed, true);
});

test('propagates transport startup failure', async () => {
    const error = new Error('bridge missing');
    const api = createAPI(async () => { throw error; });
    await assert.rejects(api.getState(), error);
    await assert.rejects(api.waitForSettle(), error);
});

test('returns a complete fallback state without a native bridge', async () => {
    assert.deepEqual(await FoldableLayout.getState(), {
        state: 'notFoldable',
        isFoldableDevice: false,
        hingeAngle: null,
        isLandscape: false,
        isVerticalHinge: false,
        fold: null,
        occlusions: []
    });
});

test('Cordova registers an independent native callback and removes it once', async () => {
    const fs = require('node:fs');
    const vm = require('node:vm');
    const calls = [];
    const module = { exports: {} };
    const exec = (success, failure, service, action, args) => {
        calls.push({ success, failure, service, action, args });
        if (action === 'unwatch') success();
    };
    vm.runInNewContext(fs.readFileSync(require.resolve('../www/cordova'), 'utf8'), {
        module,
        require(name) {
            if (name === 'cordova/exec') return exec;
            assert.equal(name, 'com.leokwsw.foldable.layout');
            return { createAPI };
        }
    });

    const states = [];
    const pending = module.exports.watch(state => states.push(state));
    assert.equal(calls[0].service, 'FoldableLayout');
    assert.equal(calls[0].action, 'watch');
    calls[0].success('folded');
    const subscription = await pending;
    calls[0].success('halfOpened');
    await subscription.remove();
    await subscription.remove();
    calls[0].success('unfolded');
    assert.equal(calls.length, 2);
    assert.equal(calls[1].action, 'unwatch');
    assert.equal(calls[1].args[0], calls[0].args[0]);
    assert.deepEqual(states, ['folded', 'halfOpened']);
});

test('Capacitor keeps the latest event when native start returns an older snapshot', async () => {
    const fs = require('node:fs');
    const vm = require('node:vm');
    const module = { exports: {} };
    let emit;
    let startedId;
    let stoppedId;
    let removed = 0;
    const bridge = {
        async addListener(event, listener) {
            assert.equal(event, 'change');
            emit = listener;
            return { async remove() { removed++; } };
        },
        async start({ id }) {
            startedId = id;
            emit({ state: 'unfolded' });
            return { state: 'halfOpened' };
        },
        async stop({ id }) { stoppedId = id; }
    };
    vm.runInNewContext(fs.readFileSync(require.resolve('..'), 'utf8'), {
        module,
        exports: module.exports,
        window: { Capacitor: { isNativePlatform: () => true } },
        require(name) {
            if (name === './www/layout') return { createAPI, avoidInsets };
            assert.equal(name, '@capacitor/core');
            return {
                registerPlugin(plugin) {
                    assert.equal(plugin, 'FoldableLayout');
                    return bridge;
                }
            };
        }
    });

    const states = [];
    const subscription = await module.exports.FoldableLayout.watch(value => states.push(value.state));
    await subscription.remove();
    await subscription.remove();
    emit({ state: 'folded' });
    assert.deepEqual(states, ['unfolded']);
    assert.equal(stoppedId, startedId);
    assert.equal(removed, 1);
});

test('uses fold posture for the iOS phone layout and window size elsewhere', () => {
    const check = FoldableLayout.isPhoneLayout;
    const unfolded = { isFoldableDevice: true, state: 'unfolded' };
    assert.equal(check(500, unfolded, 'ios'), false);
    assert.equal(check(700, { ...unfolded, state: 'folded' }, 'ios'), true);
    assert.equal(check(500, unfolded, 'android'), true);
    assert.equal(check(600, { isFoldableDevice: false }, 'ios'), false);
});
