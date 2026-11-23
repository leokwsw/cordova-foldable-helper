# Foldable Layout

[繁體中文](README.zh-TW.md)

The npm package is `@leokwsw/cordova-foldable-helper`. The Cordova plugin ID and Android namespace are `com.leokwsw.foldable`. Android uses Kotlin and iOS uses Swift. The JavaScript entry point includes TypeScript declarations.


A native plugin for Cordova, Capacitor, and Ionic apps on Android and iOS. It reports fold posture, hinge bounds and orientation, and hardware occlusions so a WebView layout can adapt as the device changes.

## Install

Use the plugin directory as `<plugin-path>`. Capacitor also accepts the npm tarball directly. For Cordova, extract a tarball first and pass the extracted package directory.

### Capacitor 8 and Ionic with Capacitor

Build your web assets before syncing. In an Ionic project, run `ionic build` to generate them. Use JDK 21 for Capacitor Android.

```sh
npm install "<plugin-path>"
npx cap sync
```

```ts
import { FoldableLayout } from '@leokwsw/cordova-foldable-helper';

const subscription = await FoldableLayout.watch(state => {
  console.log(state.state, state.hingeAngle, state.fold);
});

// Call when the component or page no longer needs updates.
await subscription.remove();
```

### Cordova and Ionic with Cordova

Requires `cordova-android` 14+ or `cordova-ios` 8+. For Android, enable Kotlin in your app's `config.xml` before preparing the platform.

```xml
<platform name="android">
    <preference name="GradlePluginKotlinEnabled" value="true" />
</platform>
```

```sh
cordova plugin add "<plugin-path>"
```

On a clean checkout, run the add command before `cordova prepare`. Cordova restores missing plugins by plugin ID, which differs from this package’s npm name.

```js
document.addEventListener('deviceready', async () => {
  try {
    const subscription = await window.FoldableLayout.watch(console.log);
    // Keep the handle and call subscription.remove() when leaving the page.
  } catch (error) {
    console.error('Could not start fold monitoring', error);
  }
}, { once: true });
```

## API

| Method | Behaviour |
| --- | --- |
| `watch(listener, onError?)` | Delivers the initial state and subsequent changes. Returns a promise for a handle with an idempotent `remove()` method. |
| `getState()` | Reads the first available snapshot, then releases the subscription. |
| `waitForSettle(quietWindow = 400)` | Returns the latest snapshot after the given number of milliseconds with no changes. |
| `avoidInsets(area, state, options?)` | Computes padding for an active fold and hardware occlusions. Supports `direction: 'ltr' \| 'rtl'`, `avoidFold`, and `avoidCamera`. Both avoidance options default to `true`. |
| `isPhoneLayout(shortestSide, state, platform)` | Uses a phone layout on iOS foldables while closed. On other devices, uses a phone layout below 600 logical pixels. Pass `ios`, `android`, or `web`. |

Posture values are `notFoldable`, `unknown`, `folded`, `halfOpened`, and `unfolded`. `unknown` means hardware was detected and its posture is still unavailable. `hingeAngle` is measured in degrees when available. `fold` is nullable, and `occlusions` is an array. Each region has `left`, `top`, `right`, `bottom`, and `isActive`. A separating fold can be a line. `isLandscape` describes the window aspect ratio and `isVerticalHinge` describes the direction of the hinge.

### Applying fold and camera insets

Measure a stable container and apply padding to its child. Recalculate on fold changes and container resizes. Use a viewport meta tag with `width=device-width, initial-scale=1` and measure at the default zoom so DOM coordinates match the native WebView's logical units.

```ts
const { left, top, right, bottom } = FoldableLayout.avoidInsets(
  container.getBoundingClientRect(),
  state,
  { direction: getComputedStyle(container).direction === 'rtl' ? 'rtl' : 'ltr' },
);

content.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
```

### Platform behaviour

- **Android:** Jetpack WindowManager supplies fold geometry and can identify a flat or half-opened fold without an angle sensor. Sensor readings, where available, classify 0° as closed, 175° and above as unfolded, and intermediate angles as half-opened. Fold bounds are relative to the WebView in dp.
- **iOS:** Build with Xcode 27.1 or later. Hinge and reserved-region tracking runs on iOS 27.1 and later. Fold and camera regions are relative to the WebView in UIKit points. Earlier iOS versions report window orientation with a non-foldable state.
- **Browser:** The npm entry point reports a non-foldable state and updates orientation on resize. The Cordova global is available after `deviceready` on supported native platforms.
