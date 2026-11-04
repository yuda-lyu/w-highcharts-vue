# 狀態(現況)

本檔記當前已開發功能之最新狀態:各功能做到哪裡、對應之規則帳本條目與測試檔、已知缺口與待辦、最近一次驗證或發布之版本.只記現況,不寫過程(過程寫入`sgud/exp/experience.md`).規則帳本為藍圖(`sgud/rule/rulebook.md`),兩者比對即知尚未做到者.

## 版本與驗證

- `package.json` version:1.0.29(本輪未改版、未發布;發布由主控進行)
- 驗證於:Highcharts 11.4.8(`node_modules/highcharts`)、Vue 2.7.16、Chromium 1243(playwright,w-package-tools-e2e 1.0.14)
- 最近驗證(2026-11-01 hc33fix 修正輪):`npm test` 134 passing(src 編譯與 dist 各多次皆全綠,無間歇失敗);修前紅(HEAD 之 src)79 failing;變異1(恆`chart.update`)78 failing、變異2(不捕捉 ResizeObserver)4 failing
- `./dist` 已於本輪依`toolg/gDistRollupComps.mjs`重建(含`updateMode`)
- 最近驗證(2026-11-05 hc309 e2e埠自動換埠導入輪):`npm test`(`quiet-run --lock`,凍結碼)**156 passing／0 failing／0 pending**(134既有＋`unit-e2ePortReserve`22案);無占用時五流程皆印`[e2e-port] 埠 [830x](基準埠)`;真實占用者情境(雙棧/`127.0.0.1`/`0.0.0.0`/`::`占用者,單埠與五埠全占,整套)全綠且整組換至84xx、占用者PID存活且仍回應、被測碼打到0次、占用者127.0.0.1客戶端未被遮蔽;基準埠與位移埠產圖12/12位元組全同;與w-maplibregl-vue之e2e同時跑兩者皆綠(無共用埠);變異13/13擊殺。`test/pics`不存在(本套件不建像素標準圖),無任何標準圖變動;產品碼0改動

## 功能現況

| 功能 | 狀態 | 規則 | 測試 | 備註 |
|---|---|---|---|---|
| `WHighchartsVue`、`WHighstockVue` 建圖、`options` 變更更新 | 已做:預設重建(同一設定恆畫出同一張圖);`updateMode:'update'`為就地更新 | R01 | `e2e-update-vs-fresh`(47場景)、`e2e-navigator`、`e2e-geo-like`、`e2e-update-mode` | `src/js/genComponent.mjs` |
| prop `updateMode` | 已做:`'rebuild'`(預設)/`'update'`;非預期值用預設,不報錯 | R02 | `unit-genComponent-updateMode`、`e2e-update-mode` | `src/js/getUpdateMode.mjs`;兩元件皆轉傳 |
| ResizeObserver 捕捉與解除 | 已做:重建前與銷毀時 disconnect;含非同步圖片之圖亦收集 | R03 | `unit-genComponent-updateMode`、`e2e-rebuild-resource` | `src/js/trackResizeObserver.mjs` |
| 容器尺寸同步(v-domresize)、百分比高度、固定寬高、`chart.reflow:false` | 已做(行為未改),重建後仍成立 | R04 | `e2e-rebuild-resource`、`unit-genComponent*` | |
| 建圖失敗後恢復 | 已做:`isLive`旗標,失敗後下一次設定變更可重建 | R04 | `e2e-rebuild-resource`、`unit-genComponent-updateMode` | |
| `chart.update`已知狀況與問題之文件 | 已做:兩元件 prop JSDoc、`genComponent.mjs`檔頭、`README.md`〈updateMode〉、`sgud/exp/experience.md` | R05 | `e2e-update-mode`〈已知差異屬實〉組 | |
| e2e測試站port自動換埠(規格`dspec/e2e埠與多套件同跑.md`) | 已做:五流程基準埠8301~8305單一定義於`test/tools/e2ePorts.mjs`;被占用時各流程自動換埠(`reserveE2ePorts` `applyEnv:false`)、綁定被搶走重選、絕不殺占用者、實際埠印出;無下殺站點、無寫死網址埠、無畫面含埠流程 | R06 | `unit-e2ePortReserve`(PR-001~016)、五個`e2e-*` | `createFlow`之`inj`僅供單元測試注入 |

## 已知缺口與待辦

- 版本號與發布:未改版(`package.json` version 1.0.29),由主控發布;破壞性變更紀錄:預設由就地更新改回重建(1.0.23~1.0.29 之行為承諾「保留圖例顯隱、縮放等使用者狀態」作廢,需要者改給`updateMode="update"`),取用`$refs.xxx.chart`者須每次取最新(重建會更換圖表實例)
- 使用端 frliq 需重建 dist 並重跑其 e2e 以確認 12 案回到標準圖(未在 frliq 實測;本套件以 w-geo-vue 型設定 8 場景證明)
- 「僅資料改變就地更新、其餘重建」之混合模式(第三種`updateMode`)、「重建後還原互動狀態」(方案④)均未做(hc33 調研列為可選,使用者未裁示)
- 未測:容器`display:none`時建圖、Highmaps/Gantt、Highcharts 11.4.8 與 Chromium 1243 以外之組合;`responsive.rules`切換
- `package.json`新增 devDependency `w-package-tools-e2e ^1.0.14`(供真瀏覽器 e2e;npm install 順帶使`package-lock.json`大幅增加,並使`package.json`末尾多一換行)
- 測試機需已安裝 playwright 之 Chromium(同姊妹套件);未安裝時`launchBrowser`會先下載
- 埠(R06)已知缺口:①偵測與綁定之間若有未導入之行程改綁萬用位址(`0.0.0.0`/`::`),Windows 下我方 `127.0.0.1` 綁定不會得 EADDRINUSE,仍會遮蔽該行程(固有時間窗,僅毫秒級;已導入之套件由預約排他涵蓋);②`w-converhp` 測試埠自 8300 起連續配發而與 8301~8305 重疊,該套件未導入且未列測試閘 `portGroups`(待主控評估);③POSIX(Linux CI)路徑未實測(共用套件自述僅有注入測試);④`setup` 與 `teardown` 無互斥——`before` 逾時(>300 秒編譯)後 `setup` 才完成者會留下未關之站與預約(需編譯超過逾時才發生,未重現)
