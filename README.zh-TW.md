# Foldable Layout

[English](README.md)

為 Cordova、Capacitor 及 Ionic 提供 Android（Kotlin）和 iOS（Swift）原生摺疊裝置支援。插件提供 JavaScript API 和 TypeScript 型別宣告，可監聽摺疊狀態與鉸鏈位置，並計算避開摺疊區域和鏡頭遮擋所需的留白。

- npm 套件名稱為 `@leokwsw/cordova-foldable-helper`。
- Cordova 插件 ID 和 Android 命名空間為 `com.leokwsw.foldable`。

## 安裝

下列指令中的 `<plugin-path>` 指本機插件目錄。Capacitor 也可以直接安裝 npm 壓縮檔。Cordova 請先解壓壓縮檔，再指定解壓後的套件目錄。

### Capacitor 8 和使用 Capacitor 的 Ionic 專案

同步前請先建置網頁資源。Ionic 專案可以執行 `ionic build`。Capacitor Android 需使用 JDK 21。

```sh
npm install "<plugin-path>"
npx cap sync
```

同一段程式可用於 JavaScript 和 TypeScript。

```js
import { FoldableLayout } from '@leokwsw/cordova-foldable-helper';

const subscription = await FoldableLayout.watch(state => {
  console.log(state.state, state.hingeAngle, state.fold);
});

// 在頁面或元件卸載時清理監聽。
await subscription.remove();
```

### Cordova 和使用 Cordova 的 Ionic 專案

需使用 `cordova-android` 14 或以上，或 `cordova-ios` 8 或以上。Android 專案請在根目錄的 `config.xml` 啟用 Kotlin，再準備 Android 平台。

```xml
<platform name="android">
    <preference name="GradlePluginKotlinEnabled" value="true" />
</platform>
```

```sh
cordova plugin add "<plugin-path>"
```

在全新簽出的專案上，請先執行上述安裝指令，再執行 `cordova prepare`。Cordova 會按插件 ID 還原缺少的插件，而此插件的 ID 與 npm 套件名稱不同。

```js
document.addEventListener('deviceready', async () => {
  try {
    const subscription = await window.FoldableLayout.watch(console.log);
    // 保留 subscription，離開頁面時呼叫 subscription.remove()。
  } catch (error) {
    console.error('無法啟動摺疊狀態監聽', error);
  }
}, { once: true });
```

## API

| 方法 | 行為 |
| --- | --- |
| `watch(listener, onError?)` | 接收首次狀態與後續更新，並傳回具備 `remove()` 的訂閱物件。可安全重複呼叫 `remove()`。 |
| `getState()` | 取得首次可用的狀態後釋放訂閱。 |
| `waitForSettle(quietWindow = 400)` | 等待指定毫秒數內沒有新變更，再傳回最新狀態。 |
| `avoidInsets(area, state, options?)` | 計算避開啟用中的摺疊區域和硬體遮擋所需的留白。可設定 `direction` 為 `ltr` 或 `rtl`，以及 `avoidFold` 和 `avoidCamera`。兩個避讓選項預設為 `true`。 |
| `isPhoneLayout(shortestSide, state, platform)` | iOS 摺疊裝置關閉時使用手機版面，其他裝置在最短邊少於 600 邏輯像素時使用手機版面。平台值為 `ios`、`android` 或 `web`。 |

摺疊狀態有 `notFoldable`、`unknown`、`folded`、`halfOpened` 和 `unfolded`。`unknown` 表示已偵測到摺疊硬體，摺疊狀態暫未取得。`hingeAngle` 有讀數時以度數表示。`fold` 可以是 `null`，`occlusions` 是陣列。每個區域均有 `left`、`top`、`right`、`bottom` 和 `isActive`。摺疊區域可以是一條沒有厚度的線。`isLandscape` 反映視窗長寬比例，`isVerticalHinge` 反映鉸鏈方向。

### 套用摺疊與鏡頭留白

量度外層容器，將計出的留白套用至內層元素。在摺疊狀態改變或容器大小變更時重新計算。將 viewport 設為 `width=device-width, initial-scale=1`，並在預設縮放比例下量度，讓 DOM 座標對應 WebView 的邏輯座標。

```js
const { left, top, right, bottom } = FoldableLayout.avoidInsets(
  container.getBoundingClientRect(),
  state,
  { direction: getComputedStyle(container).direction === 'rtl' ? 'rtl' : 'ltr' },
);

content.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
```

### 平台行為

- **Android** 使用 Jetpack WindowManager 取得摺疊區域。沒有角度感測器時，可依 WindowManager 資料識別完全展開與半開狀態。有感測器時，0° 為關閉，175° 起為展開，中間為半開。座標以 WebView 為原點，單位為 dp。
- **iOS** 使用 Xcode 27.1 或以上建置。iOS 27.1 或以上可追蹤鉸鏈與預留區域，座標以 WebView 為原點，單位為 UIKit points。較早的 iOS 版本會提供視窗方向及 `notFoldable` 狀態。
- **瀏覽器** npm 入口提供 `notFoldable` 狀態，視窗大小變更時會更新方向。Cordova 的原生全域 API 在 `deviceready` 後可用。
