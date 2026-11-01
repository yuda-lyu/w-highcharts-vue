# 規則帳本

本檔為套件設計與開發階段之規則帳本(藍圖),為要求程式碼須長成什麼樣,或由規格產出之測試(項目/說明/流程)有哪些,包含軸、單一擁有者、已知限制、破壞性變更紀錄,以及對應是哪些測試檔案或指令等,由agent自行編列、擴充與維護.當前已做到哪些記於`sgud/state/state.md`.過長時依類型拆為`rulebook_<類型>.md`,本檔只留索引.

## 規則總表

| 規則 | 一句話 | 狀態 | 對應測試 |
|---|---|---|---|
| R01 | 同一份設定之圖等同新建(預設`updateMode:'rebuild'`) | 已做 | `e2e-update-vs-fresh`、`e2e-geo-like`、`e2e-navigator` |
| R02 | `updateMode`非預期值依K3視為未給、用預設`'rebuild'` | 已做 | `unit-genComponent-updateMode`、`e2e-update-mode` |
| R03 | 重建不累積ResizeObserver與Chart殼物件,銷毀組件即解除 | 已做 | `unit-genComponent-updateMode`、`e2e-rebuild-resource` |
| R04 | 重建不改變外觀與尺寸行為(v-domresize、百分比高度、固定寬度、reflow、isPropUnchanged) | 已做 | `e2e-rebuild-resource`、`unit-genComponent`、`unit-genComponent-updateMode` |
| R05 | `chart.update`之已知狀況與問題寫入註解與文件,且文件主張於已裝Highcharts版本屬實 | 已做 | `e2e-update-mode`(〈已知差異屬實〉組) |

## R01 同一份設定之圖等同新建(預設重建)

**規則**:元件由設定A建圖後,父層將`options`改為設定B(內容不同之新物件),預設(`updateMode`未給或為`'rebuild'`)須銷毀舊圖並以`cloneOptNoReflow(B)`新建,結果與直接以B新建者相同(不變式INV-1);只有`updateMode:'update'`(opt-in)才走`chart.update`,且該模式不保證等同新建.內容相同之新物件(`isPropUnchanged`)兩模式皆不更新.

**why**:`chart.update`為合併而非取代,且Highcharts自身之update與new不等價(新建首算刻度用縮減軸長,1b),任何選項層補丁都無法保證等同(hc33調研:方案②原型仍有11/47場景可見差異);1.0.23~1.0.29預設就地更新致下游e2e標準圖與規格(同設定同圖)失效(Gitea #33).已知差異全文見`src/js/genComponent.mjs`〈chart.update之已知狀況與問題〉與`sgud/exp/experience.md`.

**盤點指令**(站點全集:`chart.update(`在`src/`僅一處,即`updateMode`為`'update'`之分支):
- `Grep "chart\.update\(" src/` → 預期僅`src/js/genComponent.mjs`之`'update'`分支1處(判準:已套=預設走重建;刻意不套=`'update'`分支)
- `Grep "ctor\(" src/js/genComponent.mjs` → 預期僅`createChart`1處(建圖唯一出口,初建與重建共用)

**測試**(語意快照逐項相同+像素差≤8px+格線在圖框之下):
- `test/e2e-update-vs-fresh.test.mjs`:47場景(Highcharts 31、Highstock 16;point1軸範圍與刻度、point2 Highstock強制選項、point3格線與圖框順序)各一案,外加建議檔〈驗證建議〉1~3之明確斷言
- `test/e2e-navigator.test.mjs`:Highstock真滑鼠拖導覽列把手/滾輪縮放,起點不被捨入,與新建逐毫秒相同
- `test/e2e-geo-like.test.mjs`:w-geo-vue型設定(FS圖max為3換無max之圖、寬高滑桿等)8場景+2項明確斷言

## R02 updateMode之值檢測(跨套件規格K3)

**規則**:`updateMode`為opt性質之prop,`'update'`以外之任何輸入(未給、null、空字串、非字串、未知字串、大小寫不同、前後空白)皆視為未給、改用預設`'rebuild'`,不報錯、不使Vue對型別報警(prop不宣告`type`);檢測函數為`src/js/getUpdateMode.mjs`(嚴格全等'update').
**依據**:`C:\opensrcOper\dspec\輸入參數之檢測機制.md` K2、K3;K3之`opt.debug`警告僅適用具opt之函數,Vue prop不適用,故不輸出警告.
**盤點指令**:`Grep "updateMode" src/` → 預期:`getUpdateMode.mjs`、`genComponent.mjs`(prop與watcher)、兩個`.vue`(prop與轉傳)
**測試**:`test/unit-genComponent-updateMode.test.mjs`(19值全數回`'rebuild'`、prop不宣告type)、`test/e2e-update-mode.test.mjs`(未給與9種非預期值皆重建:互動狀態重置)

## R03 ResizeObserver捕捉與解除

**規則**:Highcharts每建一圖於onload無條件`new ResizeObserver`且不解除(`highstock.src.js:36551-36559`、`:37262`),本元件以`src/js/trackResizeObserver.mjs`於建圖期間包裝`window.ResizeObserver`收集實例,於下次重建前與組件銷毀時`disconnect()`;建圖時`chart.hasLoaded`為false(含非同步載入圖片)者,於圖實例包裝`setReflow`使載入後建立之偵測器同樣被收集;重建先disconnect再destroy.
**盤點指令**:`Grep "ResizeObserver" src/` → 預期僅`trackResizeObserver.mjs`(包裝)與`genComponent.mjs`(收集/解除)
**測試**:`test/unit-genComponent-updateMode.test.mjs`(假ResizeObserver:收集、還原、拋錯還原、重建N次存活1個、非同步載入)、`test/e2e-rebuild-resource.test.mjs`(真瀏覽器:重建30次後存活ResizeObserver數與存活`Highcharts.Chart`物件數不增長,含Highstock與含圖片之圖;銷毀後與掛載前相同)

## R04 重建不改變外觀與尺寸行為

**規則**:重建後`chartInfo`依新設定重算、`resizeOpt`以新`refreshKey`更換(`v-domresize`重新比較),容器尺寸同步、百分比高度、固定寬高、`chart.reflow:false`不同步、自動高度容器於圖已捲出可視區時重建不使捲動位置與容器高度改變;建圖拋錯後`vm.chart`為null、舊圖已釋放,其後設定變更可重建恢復(`isLive`旗標取代原`!vo.chart`判斷,銷毀後仍不處理).
**測試**:`test/e2e-rebuild-resource.test.mjs`(尺寸同步、60%高度、固定寬度、reflow、捲動、建圖失敗恢復)、`test/unit-genComponent-updateMode.test.mjs`(resizeOpt、chartInfo、sizeFrame取消、isLive、失敗恢復)、`test/unit-genComponent.test.mjs`(輔助函數)

## R05 `chart.update`已知狀況寫入文件且屬實

**規則**:`chart.update`之已知差異(被省略之鍵沿用舊值、刻度間隔不同、`Axis.keepProps`殘留、Highstock強制選項失效、navigator開關異常、格線蓋圖框、互動狀態保留範圍)須同時寫在:①兩元件`updateMode`/`options`之prop JSDoc(每條附後果)②`src/js/genComponent.mjs`檔頭〈chart.update之已知狀況與問題〉(附Highcharts 11.4.8之`file:line`)③`README.md`〈updateMode〉一節④`sgud/exp/experience.md`;升Highcharts版本後須重跑〈已知差異屬實〉組,某案變綠表示Highcharts已修正該差異,須回頭修改上列文件.
**盤點指令**:`Grep "已知差異|已知狀況" src/ README.md`;`Grep "updateMode" README.md src/components`
**測試**:`test/e2e-update-mode.test.mjs`之〈updateMode為'update'時文件所列已知差異於Highcharts 11.4.8屬實〉組(差異(1)(2)(4)(5)(6)各一案;(3)(7)由保留縮放/導覽列/圖例/點選取案覆蓋)

## 改動範圍 → 測試檔 對照

| 改動 | 必跑 |
|---|---|
| `src/js/genComponent.mjs`、`getUpdateMode.mjs`、`trackResizeObserver.mjs`、`src/components/*.vue` | 全部(`npm test`,約2分鐘級) |
| `getContainerSize`、`getChartOptInfo`、`cloneOptNoReflow`、`isPropUnchanged` | `unit-genComponent`、`unit-genComponent-updateMode`、`e2e-rebuild-resource` |
| `iniHighcharts.mjs`、`highcharts`/`w-highcharts`版本升級 | 全部,尤其`e2e-update-mode`〈已知差異屬實〉組與`e2e-update-vs-fresh` |
| `test/host/*`、`test/tools/*` | 全部 |

## e2e映射(依role-coder-for-test-e2e範本精簡)

- 測試基礎:`test/tools/e2eLib.mjs`(單一橋接`w-package-tools-e2e`:`launchBrowser`、`pollUntil`、`assertBaselineMatch`)、`test/tools/e2e-setup.mjs`(專案組態:編譯元件、靜態站、`createFlow`)、`test/host/`(宿主頁、場景)
- 元件編譯:每個測試檔於`before`以`w-package-tools`之`rollupFiles`(同`toolg/gDistRollupComps.mjs`設定)自`src/components/WHighchartsVueAll.vue`編譯至`test/_tmp/<流程>/dist`,`after`刪除;環境變數`E2E_SRC_DIR=<含WHighchartsVueAll.vue之資料夾>`改編他版src(紅燈驗證、變異驗證),`E2E_DIST_DIR=<含w-highcharts-vue.umd.js之資料夾>`直接供應現成dist(驗證`./dist`,不編譯)
- port(固定、≥8000,與他套件錯開):`update-vs-fresh`8301、`navigator`8302、`rebuild-resource`8303、`update-mode`8304、`geo-like`8305
- 暫存:`test/_tmp/<流程>/`(測完即刪);失敗證據:`./testPending/`(gitignore、不自動刪)
- 偏離與依據:
  1. 不建像素標準圖(test/pics):本測試之不變式是「更新後之圖等同新建之圖」,以同一頁並排兩圖即時比對(語意快照+pixelmatch,容差8px,觀測雜訊4px)取代標準圖,故無標準圖產製/授權問題,`assertBaselineMatch`僅借其比對與三聯組證據
  2. 父層改變`options` prop以`page.evaluate`改宿主頁Vue實例之data(屬setup=父層行為,元件之輸入本來就是prop,無使用者可點之UI);使用者互動(點圖例、框選縮放、拖導覽列把手、滾輪、點資料點)一律真滑鼠`page.mouse`
  3. 無spec/流程_*.md、無`E2E-NNN`案例編號:本套件為元件庫,案例以場景id(`test/host/scen.js`)或測試標題識別,斷言對應之spec句為建議檔(`建議w-highcharts-vue修正.md`)〈驗證建議〉1~3與使用者裁定(Gitea #33,2026-11-01方案A)
  4. 每案fresh browser、fresh context;單一流程內場景各自一案,不承接
  5. 屬同一頁之並排比對,不使用假時鐘(圖資料為確定性產生)
