//e2eLib: w-package-tools-e2e共用實作之單一橋接, 測試檔與e2e-setup.mjs一律經此引用, 升版只改package.json之版號
//本專案不建像素標準圖(見sgud/rule/rulebook.md之e2e映射〈偏離與依據〉), 以「同一頁並排兩張圖」即時比對: 只轉出啟動瀏覽器、偵測等待與像素比對
import launchBrowser from 'w-package-tools-e2e/src/launchBrowser.mjs'
import pollUntil from 'w-package-tools-e2e/src/pollUntil.mjs'
import assertBaselineMatch from 'w-package-tools-e2e/src/assertBaselineMatch.mjs'


export {
    launchBrowser,
    pollUntil,
    assertBaselineMatch
}
