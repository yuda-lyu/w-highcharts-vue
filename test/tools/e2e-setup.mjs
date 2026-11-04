//e2e-setup: e2e測試之專案組態與專案專屬原語, 共用實作經./e2eLib.mjs單一橋接
//- 每個測試檔為一個流程, 各自以基準port(固定, 見./e2ePorts.mjs; 被占用時自動換埠)之本機靜態站與test/_tmp/<流程代號>/之編譯目錄執行, 供mocha --parallel並行
//- 元件由現行src以rollup編譯(與toolg/gDistRollupComps.mjs同設定), 預設不依賴./dist; 環境變數E2E_SRC_DIR可改指他版src/components(含WHighchartsVueAll.vue)供紅燈驗證與變異驗證,
//  環境變數E2E_DIST_DIR可改指現成dist資料夾(含w-highcharts-vue.umd.js, 不編譯)供驗證dist
//- 宿主頁test/host/index.html扮演父層頁面; 父層改變options prop屬setup(父層行為), 使用者互動(拖導覽列把手、滾輪、點圖例)一律由測試以真滑鼠進行
import fs from 'fs'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import rollupFiles from 'w-package-tools/src/rollupFiles.mjs'
import { launchBrowser, pollUntil, assertBaselineMatch } from './e2eLib.mjs'
import { FLOW_PORTS, reserveBasePort, listenWithReselect } from './e2ePorts.mjs'


let projRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..') //本模組位於test/tools, 上兩層為專案根
let testDir = path.join(projRoot, 'test')
let fdTmpRoot = path.join(testDir, '_tmp')
let fdHost = path.join(testDir, 'host')


//FLOW_PORTS(各流程靜態站之基準port, ≥8000、固定不隨機、與sgud/rule/rulebook.md之e2e映射一致)定義於./e2ePorts.mjs; 被占用時自動換埠, 實際port於createFlow之setup確定


//SCEN_IDS, 宿主頁test/host/scen.js之場景id全集(順序同檔; 有一致性案例比對, 增減場景時須同步)
let SCEN_IDS = [
    'hc-removed-minmax', 'hc-undefined-minmax', 'hc-null-minmax', 'hc-set-max3', 'hc-max3-removed', 'hc-tickinterval-removed', 'hc-tickamount-removed',
    'hc-softmax-removed', 'hc-softmax-undefined', 'hc-data-only-grow', 'hc-data-only-shrink', 'hc-userzoom-then-update', 'hc-border-order', 'hc-border-order-dataonly',
    'hc-axes-remove', 'hc-inverted', 'hc-categories-removed', 'hc-plotlines-removed', 'hc-marginleft-removed', 'hc-type-bar-line', 'hc-chain-3',
    'hc-data-only-len', 'hc-data-only-twice', 'hc-data-only-multi', 'hc-series-name-change', 'hc-linewidth-removed', 'hc-height-change', 'hc-margin-change',
    'hc-legend-toggle', 'hc-title-toggle-ymax', 'hc-ymax3-bigdata',
    'hs-data-only-len', 'hs-data-only-twice', 'hs-data-only-startontick', 'hs-navigator-off-height', 'hs-navigator-off-ymax', 'hs-startontick-forced',
    'hs-startontick-same', 'hs-startontick-endontick', 'hs-navigator-off', 'hs-navigator-off-startontick', 'hs-navigator-on', 'hs-data-only', 'hs-zoom-then-update',
    'hs-border-order', 'hs-set-max3', 'hs-removed-minmax',
]


let kpMime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
}


let sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))


//getSrcDir, 元件原始碼資料夾, 預設專案之src/components; E2E_SRC_DIR供紅燈與變異驗證改指他版
function getSrcDir() {
    let fd = process.env.E2E_SRC_DIR ? path.resolve(process.env.E2E_SRC_DIR) : path.join(projRoot, 'src', 'components')
    if (!fs.existsSync(path.join(fd, 'WHighchartsVueAll.vue'))) {
        throw new Error(`找不到元件原始碼: ${path.join(fd, 'WHighchartsVueAll.vue')}`)
    }
    return fd
}


//getDistDir, 環境變數E2E_DIST_DIR有給時回傳該現成dist資料夾之絕對路徑(相對路徑以cwd解析), 否則回傳null; 此時不編譯原始碼, 靜態站直接供應該資料夾(測試結束不刪除)
function getDistDir() {
    if (!process.env.E2E_DIST_DIR) {
        return null
    }
    let fd = path.resolve(process.env.E2E_DIST_DIR)
    let fp = path.join(fd, 'w-highcharts-vue.umd.js')
    if (!fs.existsSync(fp)) {
        throw new Error(`E2E_DIST_DIR找不到${fp}`)
    }
    return fd
}


//buildComponent, 以與toolg/gDistRollupComps.mjs相同之設定編譯元件至fdDist
async function buildComponent(fdDist) {
    fs.mkdirSync(fdDist, { recursive: true })
    await rollupFiles({
        fns: 'WHighchartsVueAll.vue',
        fdSrc: getSrcDir(),
        fdTar: fdDist,
        format: 'umd',
        hookNameDist: () => {
            return 'w-highcharts-vue'
        },
        globals: {
            'vue': 'Vue',
        },
        external: [
            'vue',
        ],
        bLog: false,
    })
    //rollupFiles內部吞掉錯誤只console.log, 且編譯前會清空輸出資料夾, 故以產物存在判定編譯成功
    let fp = path.join(fdDist, 'w-highcharts-vue.umd.js')
    if (!fs.existsSync(fp)) {
        throw new Error(`編譯元件失敗, 找不到${fp}`)
    }
}


//resolveUnder, 解碼後之路徑落於root之下才回傳絕對路徑(路徑穿越防護)
function resolveUnder(root, rel) {
    let fp = path.resolve(root, '.' + rel)
    if (fp !== root && !fp.startsWith(root + path.sep)) {
        return null
    }
    return fp
}


//startServer, 本機靜態站: /host/為宿主頁, /bundle/為本流程編譯之元件, /node_modules/僅供應vue, 其餘404
function startServer(port, fdDist) {
    let origin = `http://127.0.0.1:${port}`
    let roots = [
        ['/host/', fdHost],
        ['/bundle/', fdDist],
        ['/node_modules/vue/', path.join(projRoot, 'node_modules', 'vue')],
    ]
    let server = http.createServer((req, res) => {
        let pathname
        try {
            pathname = decodeURIComponent(new URL(req.url, origin).pathname)
        }
        catch (err) {
            res.writeHead(400)
            res.end('bad request')
            return
        }
        let fp = null
        for (let [prefix, root] of roots) {
            if (pathname.startsWith(prefix)) {
                fp = resolveUnder(root, pathname.slice(prefix.length - 1))
                break
            }
        }
        if (!fp || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
            res.writeHead(404)
            res.end('not found')
            return
        }
        res.writeHead(200, { 'content-type': kpMime[path.extname(fp)] || 'application/octet-stream', 'cache-control': 'no-store' })
        fs.createReadStream(fp).pipe(res)
    })
    return new Promise((resolve, reject) => {
        server.once('error', (err) => {
            //保留err.code供listenWithReselect辨識EADDRINUSE(被占用時換埠重試, 不殺占用者)
            let e = new Error(`無法於127.0.0.1:${port}啟動測試站(${err.code}${err.code === 'EADDRINUSE' ? ': 該port已被占用, 不下殺占用者, 由listenWithReselect換埠重試' : ''})`)
            e.code = err.code
            e.cause = err
            reject(e)
        })
        server.listen(port, '127.0.0.1', () => {
            resolve(server)
        })
    })
}


//removeFlowDir, 刪除本流程之中介資料; test/_tmp已無其他流程之資料夾時一併移除(並行中之其他檔尚在使用時保留)
function removeFlowDir(fdFlow) {
    fs.rmSync(fdFlow, { recursive: true, force: true })
    try {
        fs.rmdirSync(fdTmpRoot)
    }
    catch (err) {}
}


//createFlow, 建立一個流程之執行環境: setup於mocha之before(編譯並啟動靜態站), teardown於after(關站、釋放port保留並刪除中介資料)
//- 靜態站port: 基準port(FLOW_PORTS)被占用(含其他套件之e2e同時在跑)時自動換埠(reserveBasePort), 不殺占用者; origin由實際port衍生, 於setup確定
//- inj僅供單元測試注入(unit-e2ePortReserve): inj.port覆寫基準port, inj.fdDist指定現成dist(不編譯), inj.reserve為reserveE2ePorts選項(如regDir)
function createFlow(flow, inj = {}) {
    let base = inj.port || FLOW_PORTS[flow]
    if (!base) {
        throw new Error(`未登錄之流程代號: ${flow}`)
    }
    let origin = null //實際port(可能因被占用而位移)於setup綁定後才確定
    let fdFlow = path.join(fdTmpRoot, flow)
    let fdDist = path.join(fdFlow, 'dist')
    let server = null
    let reservation = null

    let setup = async () => {
        let fdDistGiven = inj.fdDist || getDistDir()
        if (!fdDistGiven) {
            await buildComponent(fdDist)
        }
        //編譯後才取保留並立即綁定(縮短偵測與綁定之間隔); 綁定遇EADDRINUSE則重選
        reservation = reserveBasePort(base, inj.reserve)
        try {
            let r = await listenWithReselect(reservation, base, (port) => startServer(port, fdDistGiven || fdDist))
            server = r.value
            origin = `http://127.0.0.1:${r.port}`
        }
        catch (err) {
            reservation.release()
            reservation = null
            throw err
        }
        console.log(`[e2e-port] 流程 ${flow} 測試站 ${origin}${origin.endsWith(`:${base}`) ? '(基準埠)' : `(基準埠 ${base})`}`)
    }

    let teardown = async () => {
        if (server) {
            await new Promise((resolve) => server.close(() => resolve()))
            server = null
        }
        if (reservation) {
            reservation.release()
            reservation = null
        }
        origin = null
        removeFlowDir(fdFlow)
    }

    //openCase, 每case全新context開啟宿主頁: 阻擋並記錄所有非本機請求(測試不得依賴外網); 收集主控台錯誤與pageerror
    let openCase = async (browser, opt = {}) => {
        if (!origin) {
            throw new Error(`流程 ${flow} 尚未setup(測試站未啟動)`)
        }
        let context = await browser.newContext({ viewport: { width: opt.width || 900, height: opt.height || 700 } })
        let external = []
        await context.route('**/*', (route) => {
            let u = route.request().url()
            if (u.startsWith(origin) || u.startsWith('data:')) {
                route.fallback()
                return
            }
            external.push(u)
            route.abort()
        })
        //opt.init, 頁面載入前執行之函數(例如包裝全域ResizeObserver以計數), 於元件載入前注入
        if (opt.init) {
            await context.addInitScript(opt.init)
        }
        let page = await context.newPage()
        let logs = []
        page.on('console', (m) => {
            if (m.type() === 'error') {
                logs.push(`[console.error] ${m.text().split('\n')[0]}`)
            }
        })
        page.on('pageerror', (e) => {
            logs.push(`[pageerror] ${e.message}`)
        })
        await page.goto(`${origin}/host/index.html`)
        await page.waitForFunction(() => !!window.HCT_SCEN && !!window['w-highcharts-vue'])
        return { page, context, logs, external }
    }

    //pathTmp, 本流程中介資料夾內之檔案路徑(供像素比對暫存), 自動建立資料夾
    let pathTmp = (name) => {
        fs.mkdirSync(fdFlow, { recursive: true })
        return path.join(fdFlow, name)
    }

    return { setup, teardown, openCase, pathTmp, get origin() { return origin } }
}


//comparePair, 同一頁並排兩圖(更新後U、新建N)之像素比對: 兩元素截圖, 以N存檔為基準比對U(反鋸齒感知, maxDiffPixels容差), 不符時證據存./testPending/
async function comparePair(flow, page, idU, idN, label, maxDiffPixels = 8) {
    let bufU = await page.locator('#' + idU).screenshot()
    let bufN = await page.locator('#' + idN).screenshot()
    let fp = flow.pathTmp(label.replace(/[^\w.-]/g, '_') + '.png')
    fs.writeFileSync(fp, bufN)
    assertBaselineMatch(bufU, fp, label, { maxDiffPixels }) //差異超過容差一半時印[baseline-headroom]告警(雜訊逼近容差之徵兆)
}


//cdpCount, 以CDP Runtime.queryObjects計目前存活之Highcharts.Chart物件數(含已destroy之殼): 先強制垃圾回收再計
async function cdpCount(page, context) {
    let cdp = await context.newCDPSession(page)
    try {
        await cdp.send('HeapProfiler.collectGarbage')
        let proto = await cdp.send('Runtime.evaluate', { expression: 'window.Highcharts.Chart.prototype' })
        let q = await cdp.send('Runtime.queryObjects', { prototypeObjectId: proto.result.objectId })
        let r = await cdp.send('Runtime.callFunctionOn', { objectId: q.objects.objectId, functionDeclaration: 'function() { return this.length }', returnByValue: true })
        return r.result.value
    }
    finally {
        await cdp.detach()
    }
}


export {
    SCEN_IDS,
    FLOW_PORTS,
    launchBrowser,
    pollUntil,
    sleep,
    createFlow,
    comparePair,
    cdpCount,
}
