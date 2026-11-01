//e2e-rebuild-resource: 預設重建模式之資源與行為(Gitea #33)
//- Highcharts每建一圖即無條件新增一個不解除之ResizeObserver(highstock.src.js:36551-36559、呼叫處:37262), 回呼閉包持有已destroy之圖殼物件; 重建N次後存活之ResizeObserver與Highcharts.Chart物件不得隨N增長, 銷毀組件後皆解除
//- 重建不改變外觀與尺寸行為: 容器尺寸同步(v-domresize)、百分比高度、固定寬度、chart.reflow為false; 自動高度容器於圖已捲出可視區時重建不使捲動位置與容器高度改變
//- 建圖失敗(設定無效)後下一次設定變更可恢復; 含非同步載入圖片之圖亦不累積
//計數: 於頁面載入前包裝window.ResizeObserver(建立數、disconnect數), 存活Chart物件數以CDP Runtime.queryObjects(Highcharts.Chart.prototype)於強制垃圾回收後計得
//父層改變options prop屬setup; 容器尺寸改變以改容器style模擬(使用者拖拉視窗/版面之結果)
import assert from 'assert'
import { launchBrowser, pollUntil, createFlow, cdpCount, sleep } from './tools/e2e-setup.mjs'


let flow = createFlow('rebuild-resource')


//roInit, 頁面載入前包裝ResizeObserver, 計建立數與disconnect數
let roInit = () => {
    let RO0 = window.ResizeObserver
    window.__ro = { created: 0, disconnected: 0 }
    window.ResizeObserver = class extends RO0 {
        constructor(cb) {
            super(cb)
            window.__ro.created++
        }
        disconnect() {
            window.__ro.disconnected++
            return super.disconnect()
        }
    }
}


describe('e2e-rebuild-resource：重建不累積資源且不改變外觀與尺寸行為', function() {

    let browser = null

    before(async function() {
        this.timeout(300000) //含rollup編譯元件
        await flow.setup()
    })

    after(async function() {
        await flow.teardown()
    })

    beforeEach(async function() {
        browser = await launchBrowser()
    })

    afterEach(async function() {
        if (browser) {
            await browser.close()
            browser = null
        }
    })

    //cycle, 於頁面內掛載元件(Highcharts)、依序改變options prop n次(每次不同資料, 皆為重建)、可選擇銷毀, 回傳掛載前後ResizeObserver存活數
    let cycle = (page, { n, destroy, mode, hasMode, kind }) => page.evaluate(async ({ n, destroy, mode, hasMode, kind }) => {
        let D = window.HCT
        let mk = (i) => (kind === 'hs' ? window.HCT_hsBase({}, 100, i + 1) : window.HCT_hcBase({}, 100, i + 1))
        let ro0 = window.__ro.created - window.__ro.disconnected
        let el = D.mkDiv()
        let U = await D.make(kind || 'hc', mk(0), el, mode, !!hasMode)
        let aliveMounted = window.__ro.created - window.__ro.disconnected
        for (let i = 1; i <= n; i++) {
            await U.update(mk(i))
        }
        let aliveEnd = window.__ro.created - window.__ro.disconnected
        let created = window.__ro.created
        if (destroy) {
            U.destroy()
            await D.sleep(50)
        }
        let aliveDestroyed = window.__ro.created - window.__ro.disconnected
        window.__last = { U: destroy ? null : U, el }
        return { ro0, aliveMounted, aliveEnd, aliveDestroyed, created }
    }, { n, destroy, mode, hasMode, kind })

    it('重建30次後存活之ResizeObserver數與掛載時相同(不隨次數增長), 銷毀組件後與掛載前相同', async function() {
        for (let kind of ['hc', 'hs']) {
            let { page, context, logs } = await flow.openCase(browser, { init: roInit })
            let r = await cycle(page, { n: 30, destroy: true, kind })
            console.log(`      [量測] ${kind}: ResizeObserver 掛載時存活${r.aliveMounted}、重建30次後存活${r.aliveEnd}、累計建立${r.created - r.ro0}、銷毀後存活${r.aliveDestroyed - r.ro0}`)
            assert.strictEqual(r.aliveEnd, r.aliveMounted, `${kind} 重建30次後存活ResizeObserver增加${r.aliveEnd - r.aliveMounted}個`)
            assert.strictEqual(r.aliveDestroyed, r.ro0, `${kind} 銷毀後仍存活${r.aliveDestroyed - r.ro0}個ResizeObserver`)
            //重建確實發生: 每次重建新建一個(Highcharts於onload建立), 故建立數至少為31
            assert.ok(r.created - r.ro0 >= 31, `${kind} 建立數${r.created - r.ro0}`)
            assert.deepStrictEqual(logs, [])
            await context.close()
        }
    })

    it('重建30次後存活之Highcharts.Chart物件數有上界(不含30個已destroy之殼), 不隨次數增長', async function() {
        let { page, context, logs } = await flow.openCase(browser, { init: roInit })
        await cycle(page, { n: 5, destroy: false })
        let c5 = await cdpCount(page, context)
        await page.evaluate(() => window.__last.U.destroy())
        await cycle(page, { n: 30, destroy: false })
        let c30 = await cdpCount(page, context)
        console.log(`      [量測] 存活Highcharts.Chart物件: 重建5次後${c5}個、重建30次後${c30}個`)
        //n=30時: 現行圖1個(另容許首圖/前一輪殘留各至多1個); 每次重建若不解除ResizeObserver則約為n+2個
        assert.ok(c30 <= 3, `存活Chart物件${c30}個`)
        assert.ok(c30 <= c5 + 1, `n=5為${c5}個, n=30為${c30}個, 隨次數增長`)
        assert.deepStrictEqual(logs, [])
        await context.close()
    })

    it("updateMode為'update'時不新建圖: 更新30次後ResizeObserver建立數不增加, 銷毀後與掛載前相同", async function() {
        let { page, context, logs } = await flow.openCase(browser, { init: roInit })
        let r = await cycle(page, { n: 30, destroy: true, mode: 'update', hasMode: true })
        let created = r.created - r.ro0
        assert.ok(created <= 3, `建立數${created}`) //Highcharts之偵測器1個與v-domresize之偵測器, 更新不新增
        assert.strictEqual(r.aliveEnd, r.aliveMounted)
        assert.strictEqual(r.aliveDestroyed, r.ro0)
        assert.deepStrictEqual(logs, [])
        await context.close()
    })

    it('重建後舊圖物件已destroy, 組件之chart屬性為新圖物件', async function() {
        let { page, context, logs } = await flow.openCase(browser, { init: roInit })
        let r = await page.evaluate(async () => {
            let D = window.HCT
            let U = await D.make('hc', window.HCT_hcBase({}, 100, 1), D.mkDiv())
            let c0 = U.chart
            await U.update(window.HCT_hcBase({}, 100, 2))
            let c1 = U.chart
            return { same: c0 === c1, oldDestroyed: c0.renderer === undefined && c0.container === undefined, newAlive: !!c1.renderer, charts: window.Highcharts.charts.filter(Boolean).length }
        })
        assert.strictEqual(r.same, false)
        assert.strictEqual(r.oldDestroyed, true)
        assert.strictEqual(r.newAlive, true)
        assert.strictEqual(r.charts, 1) //Highcharts.charts僅含現行圖
        assert.deepStrictEqual(logs, [])
        await context.close()
    })

    it('圖含需非同步載入之圖片(建圖時chart.hasLoaded為false)時, 重建10次亦不累積ResizeObserver', async function() {
        let { page, context, logs } = await flow.openCase(browser, { init: roInit })
        let r = await page.evaluate(async () => {
            let D = window.HCT
            let png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
            let mk = (i) => D.merge(window.HCT_hcBase({}, 100, i + 1), { plotOptions: { series: { marker: { enabled: true, symbol: 'url(' + png + ')' } } } })
            let host = document.createElement('div')
            let el = D.mkDiv()
            el.appendChild(host)
            let vm = new window.Vue({ el: host, data: { opts: mk(0) }, render: function(h) { return h('w-highcharts-vue', { props: { options: this.opts } }) } })
            let hasLoadedAtMount = D.findChart(vm).hasLoaded //掛載同步後即讀: 含圖片時尚未onload(Highcharts於onload才設為true, 之前為undefined)
            await D.sleep(300)
            let aliveMounted = window.__ro.created - window.__ro.disconnected
            for (let i = 1; i <= 10; i++) {
                vm.opts = D.clone(mk(i))
                await D.sleep(150)
            }
            let aliveEnd = window.__ro.created - window.__ro.disconnected
            vm.$destroy()
            await D.sleep(50)
            return { hasLoadedAtMount, aliveMounted, aliveEnd, aliveDestroyed: window.__ro.created - window.__ro.disconnected }
        })
        assert.ok(!r.hasLoadedAtMount, '前提: 含圖片之圖掛載當下尚未載入完成(非同步onload分支)')
        assert.strictEqual(r.aliveEnd, r.aliveMounted)
        assert.ok(r.aliveDestroyed <= r.aliveMounted - 2, `銷毀後存活${r.aliveDestroyed}個, 掛載時${r.aliveMounted}個`)
        assert.deepStrictEqual(logs, [])
        await context.close()
    })

    it('建圖失敗(設定無效)後, 下一次設定變更可恢復為與新建相同, 不卡死', async function() {
        let { page, context } = await flow.openCase(browser)
        let r = await page.evaluate(async () => {
            let D = window.HCT
            let errs = []
            window.Vue.config.errorHandler = (err) => errs.push(String(err && err.message))
            let U = await D.make('hc', window.HCT_hcBase({}, 100, 1), D.mkDiv())
            await U.update(D.merge(window.HCT_hcBase({}, 100, 2), { chart: { type: 'nonexistent-type' } })) //B: 無效之系列型別, 建圖拋錯
            let afterBad = { errs: errs.slice(), hasChart: !!U.chart }
            let C = window.HCT_hcBase({}, 100, 3)
            await U.update(C)
            let N = await D.make('hc', C, D.mkDiv())
            await D.sleep(60)
            let sU = D.snap(U.chart)
            let sN = D.snap(N.chart)
            delete sU.order.names
            delete sN.order.names
            return { afterBad, diffs: D.diff(sU, sN), series: U.chart.series.length, errsEnd: errs.length }
        })
        assert.ok(r.afterBad.errs.length >= 1, '無效設定應使建圖拋錯並由Vue錯誤處理接住')
        assert.strictEqual(r.afterBad.hasChart, false) //舊圖已釋放, 新圖未建成
        assert.deepStrictEqual(r.diffs, []) //恢復後與以該設定新建者相同
        assert.strictEqual(r.series, 1)
        assert.strictEqual(r.errsEnd, r.afterBad.errs.length) //恢復後不再有錯誤
        await context.close()
    })

    //以下為重建後之外觀與尺寸行為(不得改變): v-domresize之容器尺寸同步、百分比高度、固定寬度、chart.reflow為false

    //mountBox, 於頁面內掛載元件於指定寬度之容器(高度由內容決定), 回傳box之id
    let mountBox = (page, { width, opts }) => page.evaluate(async ({ width, opts }) => {
        let D = window.HCT
        let box = document.createElement('div')
        box.id = 'box'
        box.style.cssText = 'width:' + width + 'px;'
        document.body.appendChild(box)
        let host = document.createElement('div')
        box.appendChild(host)
        window.__vm = new window.Vue({ el: host, data: { opts: opts }, render: function(h) { return h('w-highcharts-vue', { props: { options: this.opts } }) } })
        await D.sleep(100)
        return true
    }, { width, opts })
    let setOpts = (page, opts) => page.evaluate(async (opts) => {
        window.__vm.opts = window.HCT.clone(opts)
        await window.HCT.sleep(100)
    }, opts)
    let size = (page) => page.evaluate(() => {
        let c = window.HCT.findChart(window.__vm)
        return { w: c.chartWidth, h: c.chartHeight, boxW: document.getElementById('box').clientWidth }
    })
    let setBoxWidth = (page, w) => page.evaluate((w) => { document.getElementById('box').style.width = w + 'px' }, w)

    let base = { title: { text: null }, credits: { enabled: false }, chart: { animation: false }, series: [{ data: [1, 3, 2, 4] }] }

    it('重建後圖寬高跟隨容器: 容器寬度改變時圖表尺寸同步(v-domresize)', async function() {
        let { page, context, logs } = await flow.openCase(browser)
        await mountBox(page, { width: 600, opts: base })
        await setOpts(page, { ...base, series: [{ data: [4, 3, 2, 1] }] }) //重建
        let s0 = await size(page)
        assert.strictEqual(s0.w, 600)
        assert.strictEqual(s0.h, 400) //未給高度時Highcharts預設400
        await setBoxWidth(page, 450)
        await pollUntil('圖寬跟隨容器450', async () => (await size(page)).w === 450)
        await setBoxWidth(page, 700)
        await pollUntil('圖寬跟隨容器700', async () => (await size(page)).w === 700)
        assert.deepStrictEqual(logs, [])
        await context.close()
    })

    it('重建後百分比高度仍隨寬度變化(chart.height為60%)', async function() {
        let { page, context, logs } = await flow.openCase(browser)
        let opts = { ...base, chart: { animation: false, height: '60%' } }
        await mountBox(page, { width: 600, opts })
        await setOpts(page, { ...opts, series: [{ data: [4, 3, 2, 1] }] }) //重建
        let s0 = await size(page)
        assert.strictEqual(s0.w, 600)
        assert.strictEqual(s0.h, 360)
        await setBoxWidth(page, 500)
        await pollUntil('百分比高度跟隨寬度500', async () => {
            let s = await size(page)
            return s.w === 500 && s.h === 300
        })
        assert.deepStrictEqual(logs, [])
        await context.close()
    })

    it('重建後chart.width給固定值者不隨容器變化, 重建為未給固定寬度後改為跟隨容器', async function() {
        let { page, context, logs } = await flow.openCase(browser)
        let fixed = { ...base, chart: { animation: false, width: 400 } }
        await mountBox(page, { width: 600, opts: fixed })
        await setOpts(page, { ...fixed, series: [{ data: [4, 3, 2, 1] }] }) //重建, 仍固定
        await setBoxWidth(page, 500)
        await sleep(400) //負向觀察: 固定寬度不應改變, 以事件同步無法判定「不發生」, 故給短暫觀察窗
        assert.strictEqual((await size(page)).w, 400)
        await setOpts(page, base) //移除固定寬度(重建)
        await pollUntil('移除固定寬度後圖寬跟隨容器500', async () => (await size(page)).w === 500)
        assert.deepStrictEqual(logs, [])
        await context.close()
    })

    it('重建後chart.reflow為false者不同步容器尺寸', async function() {
        let { page, context, logs } = await flow.openCase(browser)
        let nf = { ...base, chart: { animation: false, reflow: false } }
        await mountBox(page, { width: 600, opts: nf })
        await setOpts(page, { ...nf, series: [{ data: [4, 3, 2, 1] }] }) //重建
        await setBoxWidth(page, 450)
        await sleep(400) //負向觀察窗
        assert.strictEqual((await size(page)).w, 600)
        assert.deepStrictEqual(logs, [])
        await context.close()
    })

    it('自動高度容器(chart.height固定、容器無高度)於圖已捲出可視區上方時重建, 捲動位置與容器高度不變', async function() {
        let { page, context, logs } = await flow.openCase(browser, { height: 600 })
        await page.evaluate(async () => {
            let D = window.HCT
            let box = document.createElement('div')
            box.id = 'box'
            box.style.cssText = 'width:600px;'
            document.body.appendChild(box)
            let sp = document.createElement('div')
            sp.style.cssText = 'height:3000px;'
            document.body.appendChild(sp)
            let host = document.createElement('div')
            box.appendChild(host)
            let o = { title: { text: null }, credits: { enabled: false }, chart: { animation: false, height: 300 }, series: [{ data: [1, 3, 2, 4] }] }
            window.__o = o
            window.__vm = new window.Vue({ el: host, data: { opts: o }, render: function(h) { return h('w-highcharts-vue', { props: { options: this.opts } }) } })
            await D.sleep(100)
            window.scrollTo(0, 800) //圖(0~300)已捲出可視區上方
            await D.sleep(100)
        })
        let m0 = await page.evaluate(() => ({ y: window.scrollY, h: document.getElementById('box').offsetHeight }))
        assert.strictEqual(m0.y, 800)
        assert.strictEqual(m0.h, 300)
        for (let i = 0; i < 5; i++) {
            await setOpts(page, { title: { text: null }, credits: { enabled: false }, chart: { animation: false, height: 300 }, series: [{ data: [i, 3, 2, 4] }] })
            let m = await page.evaluate(() => ({ y: window.scrollY, h: document.getElementById('box').offsetHeight }))
            assert.deepStrictEqual(m, m0, `第${i + 1}次重建後`)
        }
        assert.deepStrictEqual(logs, [])
        await context.close()
    })

})
