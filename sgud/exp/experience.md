# 累積經驗

本檔為執行工作時特有之累積經驗,留給後續之嘗試、執行與判斷,由agent自行編列、擴充與維護.過長時抽出舊者為`experience_<年月日>.md`,並於本檔註明何時抽出.

## 一、Highcharts `chart.update`(就地更新)不等價於新建(2026-11-01 hc33 調研,Highcharts 11.4.8)

來源:Gitea #33;完整報告與證據在主控任務夾 `dnow/20261031234910/agent-out/hc33-調研報告.md`、`hc33-evidence/`.下列為可直接用於後續判斷之要點(行號為 `node_modules/highcharts/highstock.src.js`,核心區段與 `highcharts.src.js` 相同):

- 更新是**合併**:`Chart.update` 先 `diffObjects(新設定, chart.options)`(`:37593`),軸再 `merge(this.userOptions, diff)`(`:21392`);新設定**省略**之鍵(min/max/tickInterval/marginLeft/plotLines…)沿用舊值,僅顯式 `undefined` 可覆寫(`:412-414`);預設值非 undefined 之鍵不能用 undefined 還原.
- **新建首算 y 軸刻度用「繪圖區高 − x 軸標籤預留」之軸長,更新用最終軸長**(`:36979-37054` 對 `:35848-35851`):同設定同尺寸下刻度間隔也可能不同,連只改系列名稱或只改資料都會;**無選項層修法,只有重建能與新建等同**.
- 每次 `Axis.update` 銷毀並重建格線群組,新群組與圖框同為 zIndex 1 而排在其後 → 格線蓋住圖框(每次 `chart.update` 皆發生,含僅改資料).只傳 `{series}` 子集則不呼叫 `Axis.update`,無此問題.
- Highstock 強制 `startOnTick/endOnTick:false`(`getForcedAxisOptions`,`:53535-53551`)與 Stock 預設只在建圖時套用;使用端設定帶 `startOnTick:true` 者,第一次更新(即使只差資料)即失效.
- `Navigator.update`(`:49042-49053`)關閉時不移除 `chart.navigator`/`chart.scrollbar`,其 `getMargins` 監聽(`:50097-50108`)恆加 `navigatorOptions.margin`(25)→ 繪圖區變矮;無 navigator 建圖後更新為啟用則根本不會出現.
- `Axis.keepProps`(`:21472-21481`)使 `userMin/userMax/len` 更新後保留;`hardMin = pick(axis.userMin, options.min)`(`:19520`).
- 就地更新**保留**縮放(x/y/框選)、導覽列範圍、圖例隱藏;**不保留**點選取與 tooltip 懸停(hoverPoint 清空,tooltip 殘留舊內容).重建全數遺失.
- Highcharts 每建一圖(`onload` → `setReflow`,`:36551-36559`、`:37262`)無條件 `new ResizeObserver` 且不解除,即使 `chart.reflow:false`;重建 30 次後存活 `Chart` 物件 32 個(1 基線 + 1 現行 + 30 個已 `destroy` 之殼,持有者為 RO 回呼閉包),捕捉該 RO 並於下次重建前 `disconnect()` 可降為 2.
- `vue-highcharts@0.1.0`(1.0.22 以前)之行為:watch 後於同一容器 `ctor(this.$el, clone(options))`,舊圖由 Highcharts `getContainer`(`:36333-36337`)自動銷毀;即「設定變更即重建」.

## 一之二、hc33fix 修正輪(2026-11-01,使用者裁定方案A)之決定與經驗

- 預設改回「options 變更即重建」,新增 prop `updateMode`(`'rebuild'` 預設/`'update'` = 現行就地更新);非預期值(非字串、未知字串、大小寫不同、前後空白)依跨套件規格K3視為未給、用預設,prop 不宣告 `type`(宣告了 Vue 對非字串會報警);不輸出 K3 之 `opt.debug` 警告(那是具 opt 之函數用,Vue prop 不適用).
- 重建於同一 tick 內「disconnect 舊 ResizeObserver → destroy → ctor」,`resizeOpt` 以新 `refreshKey` 更換使 v-domresize 重新比較;容器被 destroy 清空後同步重建,捲出可視區之自動高度容器 scrollY/高度不變(e2e 已證).
- ResizeObserver:建圖期間以**函數包裝**(`Tracked.prototype = Orig.prototype`,回傳原生實例)暫換 `window.ResizeObserver` 收集,不用 `class extends`(避免轉譯器對原生類別繼承之問題);圖含非同步載入圖片時 Highcharts 於載入完成才 `setReflow`——注意 `chart.hasLoaded` 在 onload 前為 **undefined**(不是 false),判斷用 `!chart.hasLoaded`;此時於圖實例上包裝 `setReflow` 補收集.
- 建圖拋錯:`createChart` 先將 `vo.chart` 設 null;以 `isLive`(掛載後 true、銷毀後 false)取代原 `if (!vo.chart) return` 之判斷,使失敗後下一次設定變更可重建恢復;`updateMode:'update'` 而無圖表時亦改走重建.實測無效 `chart.type` 會使 Highcharts 建構函數拋錯(error #17),可用來測此路徑.
- 測試架構:`test/tools/e2e-setup.mjs` 於 `before` 以 `w-package-tools/rollupFiles` 編譯 `src/components/WHighchartsVueAll.vue` 為 UMD(約數秒)至 `test/_tmp/<流程>/dist`,靜態站(基準 port 8301~8305,被占用時自動換埠,見下〈三〉)供應宿主頁 `test/host/`;`E2E_SRC_DIR=<含WHighchartsVueAll.vue之資料夾>` 改編他版 src,`E2E_DIST_DIR=./dist` 直接測 dist.修前紅=`git archive HEAD src | tar -x -C ./tmp/hc33fix/old` 後 `E2E_SRC_DIR=./tmp/hc33fix/old/src/components`;變異=`cp -r src ./tmp/hc33fix/mutN/` 改一行再同樣指定.全套約 1 分鐘(`mocha --parallel` 五個 e2e 檔並行).
- 計數 Highcharts.Chart 殼物件:CDP `HeapProfiler.collectGarbage` 後 `Runtime.queryObjects(Highcharts.Chart.prototype)`;ResizeObserver 存活數:`context.addInitScript` 於載入前包裝 `window.ResizeObserver` 計 created/disconnected.實測(新碼):重建 30 次後存活 RO 與掛載時相同(3)、存活 Chart 物件 2 個(重建 5 次亦 2 個);變異(不捕捉)時 RO +30、Chart 38 個.
- Highstock FS 圖(`yAxis.min:0,max:3` 且 endOnTick 預設 true)之實際軸上限會進位到刻度(測試中為 4),斷言應比對「`options.max===3` 與新建之實際範圍相同」,不要寫死 3.
- `updateMode:'update'` 之文件主張以測試守住(`e2e-update-mode` 〈已知差異屬實〉組):某案變綠=Highcharts 已修該差異,須回頭改 prop JSDoc、`genComponent.mjs` 檔頭、README.

## 二、探測方法

- 「就地更新 vs 新建」並排比對:同一頁以場景 `steps=[A,B,…]` 建圖後逐一更新,再以最後設定新建一張同尺寸圖,比對各軸 `min/max/tickInterval/tickPositions/options.startOnTick`、繪圖區幾何、SVG 子節點順序、pixelmatch 截圖;每次 `setTickInterval` 計 `axis.len` 可看出首算軸長差異.此即「同一設定之就地更新與新建結果相同」不變式之驗證器雛形(`hc33-evidence/repro/`).
- jsdom 可先做機制預檢(需 polyfill `offsetWidth/offsetHeight/scrollWidth/scrollHeight/getBoundingClientRect/getBBox/getComputedTextLength/ResizeObserver`),但**證據一律用真瀏覽器**.
- 真滑鼠點圖例應點**圖例文字**(`legendItem.label`)中心;點 `legendItem.group` 中心會落在背景 rect 而無效.
- Bash 工具傳含中文之字面路徑會亂碼(用萬用字元或寫成 `.mjs` 內以 `fs.readdirSync` 取);playwright 借用他套件 `node_modules/playwright-core`(唯讀 `import(file URL)`).
- 測試鎖排隊可達 45 分鐘以上;Bash 背景指令預設 10 分鐘即被終止並失去排隊位置,須以 `run_in_background` 加 `timeout:7200000` 並給 `quiet-run --timeout 6000`;等待時以 node 腳本輪詢佇列檔(不用 shell sleep).

## 三、hc309(2026-11-05)e2e 埠自動換埠之經驗

- **「全綠」與「占用者沒被殺」都不能證明沒擾及占用者**:Windows 允許 `127.0.0.1:P` 與他人之 `::`(node 預設雙棧)/`0.0.0.0`:P 並存,舊碼 `server.listen(P, '127.0.0.1')` 因此在雙棧占用者存在時仍綁得上、52/134 全綠,但此時占用者自己的 `127.0.0.1` 客戶端連到的是我們的站(測試期間 103/129 次探測回 `404 not found`);只有占用者綁 `127.0.0.1` 時舊碼才拋 EADDRINUSE。驗收要用真實占用者＋從 `127.0.0.1` 持續探測占用者埠,看回應是否仍是占用者(`tmp/hc309/scenario.mjs` 之遮蔽探測)。
- **探測用的 HTTP 請求要 `agent:false` ＋ `connection:close`**:node 預設 keep-alive 會重用開跑前建好的連線,探測永遠到占用者,看不出被遮蔽(第一版驅動因此把遮蔽量成 0)。
- 本專案**無下殺站點**:共用函式的「殘留預約下殺」只殺預約檔 `known` 內身分已確認者,而 `known` 只由 `noteOwn` 寫入,本專案不呼叫 → 預約檔 `known` 恆 `[]`(實查登錄目錄 `~/.w-package-tools-e2e/port-reservations/p84xx.json`)。
- 行程內監聽者(靜態站)的導入形狀:`reserveE2ePorts([base], { applyEnv:false, avoid })` 於 `setup`(編譯後、綁定前)取保留、`listenWithReselect` 綁定遇 `EADDRINUSE` 重選、`teardown` 釋放;`origin` 於綁定後才確定,故為 getter,`openCase` 在 `setup` 前拋錯。`startServer` 包裝錯誤時要保留 `err.code`,否則重選認不得 `EADDRINUSE`。
- `mocha --parallel` 下多個 worker 各自載入 `e2e-setup.mjs`:不要在模組最上層取保留(會每個 worker 一份且不釋放),在 `before`(`setup`)取、`after`(`teardown`)放;各流程基準埠相差 1~4、位移為 100 的倍數,不會選到同一實際埠。
- 單元測試要與環境無關:開跑前清除 `E2E_PORT_OFFSET`/`E2E_PORT_HOLD`(`applyEnv:false` 時共用函式仍以 `process.env` 之位移為起點;多開工具或手動指定時會使期望位移不符)、測試用埠自空閒區動態挑選且避開真實流程埠(同一次 `mocha --parallel` 有 e2e 檔在跑)、位址族不支援時 `this.skip()` 而非靜默退化為「無占用者」、探測 HTTP 失敗重試(高負載偶發逾時不當成被遮蔽)。
- 跨套件:`w-converhp` 測試埠自 8300 起連續配發(`test/tools/ports.mjs`,數十個),與本套件 8301~8305(位移後 8401~8405 亦可能)重疊,該套件未導入、也未列於測試閘 `portGroups`;兩者同機同跑時本套件先綁則其測試失敗,其先綁則本套件換埠(本輪未實測此組合,以免干擾他套件)。
- 變異測試若變異使 `opt`(如 `maxTries`)失效,單元測試會在預設 20 次位移上逐一 `describePortOwners`(PowerShell),單一變異可達 10 分鐘;變異腳本之 `spawnSync` 逾時須設短。
