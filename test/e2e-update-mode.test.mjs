//e2e-update-mode: prop updateMode(Gitea #33)
//- 'update'(opt-in)維持就地更新: 保留縮放、導覽列範圍、圖例隱藏, 不保留點選取(prop說明所載); 'update'不保證等同重建, prop說明所列已知差異於Highcharts 11.4.8屬實
//- 預設(未給)、'rebuild'、非預期值(非字串、未知字串, 依跨套件規格輸入參數之檢測機制K3視為未給)皆為重建: 縮放、導覽列範圍、圖例顯隱重置
//互動一律為真滑鼠(page.mouse): 點圖例文字、框選縮放、拖導覽列把手、點資料點; 父層改變options prop(僅改標題)屬setup
import assert from 'assert'
import { SCEN_IDS, launchBrowser, createFlow, sleep } from './tools/e2e-setup.mjs'


let flow = createFlow('update-mode')


describe('e2e-update-mode：updateMode為update保留互動狀態, 預設與非預期值為重建', function() {

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

    //hcOpt, Highcharts設定(兩系列、圖例、x軸框選縮放、資料點可選取), title為父層之可變項(僅改標題即為一次設定變更)
    let hcOpt = (title) => ({
        chart: { type: 'line', animation: false, zoomType: 'x', width: 600, height: 350, marginLeft: 60, marginRight: 20, marginTop: 40, marginBottom: 80 },
        title: { text: title },
        credits: { enabled: false },
        legend: { enabled: true },
        plotOptions: { series: { animation: false, allowPointSelect: true, marker: { enabled: true, radius: 5 } } },
        series: [
            { name: 's1', data: [1, 3, 2, 5, 4, 6, 5, 8, 7, 9, 8, 10, 9, 12, 11, 13, 12, 15, 14, 16] },
            { name: 's2', data: [3, 2, 4, 3, 6, 5, 7, 6, 9, 8, 10, 9, 12, 11, 13, 12, 15, 14, 16, 15] },
        ],
    })

    //open, 開頁並掛載元件(kind: 'hc'|'hs'), spec為{hasMode, mode}; 回傳{page, context, logs}
    let open = async (kind, spec) => {
        let c = await flow.openCase(browser, { width: 900, height: 700 })
        await c.page.evaluate(async ([kind, spec, hc]) => {
            let D = window.HCT
            let A = kind === 'hs' ? window.HCT_hsBase({}, 100, 5) : hc
            let U = await D.make(kind, A, D.mkDiv(kind === 'hs' ? 700 : 600, 350), spec.mode, !!spec.hasMode)
            window.__U = U
            window.__A = A
            await D.sleep(100)
        }, [kind, spec, hcOpt('A')])
        return c
    }
    let geo = (page) => page.evaluate(() => window.HCT.geo(window.__U.chart))
    let state = (page) => page.evaluate(() => window.HCT.state(window.__U.chart))

    //changeTitle, 父層僅改標題(一次設定變更)
    let changeTitle = (page) => page.evaluate(async () => {
        let B = window.HCT.clone(window.__A)
        B.title = { text: 'B' }
        await window.__U.update(B)
    })

    //hideLegend0, 真滑鼠點第1個圖例項文字(s1)使其隱藏
    let hideLegend0 = async (page) => {
        let g = await geo(page)
        await page.mouse.move(g.legendItems[0].x, g.legendItems[0].y)
        await page.mouse.click(g.legendItems[0].x, g.legendItems[0].y)
        await sleep(150)
    }

    //zoomDrag, 真滑鼠於繪圖區由30%處框選至60%處(zoomType為x)
    let zoomDrag = async (page) => {
        let g = await geo(page)
        let y = g.plot.y + g.plot.h * 0.5
        await page.mouse.move(g.plot.x + g.plot.w * 0.3, y)
        await page.mouse.down()
        await page.mouse.move(g.plot.x + g.plot.w * 0.45, y, { steps: 6 })
        await page.mouse.move(g.plot.x + g.plot.w * 0.6, y, { steps: 6 })
        await page.mouse.up()
        await sleep(200)
    }

    //dragHandle, 真滑鼠拖左側導覽列把手向右dx px
    let dragHandle = async (page, dx) => {
        let g = await geo(page)
        let hd = g.handles[0]
        assert.ok(hd, '找不到導覽列把手')
        await page.mouse.move(hd.x, hd.y)
        await page.mouse.down()
        await page.mouse.move(hd.x + dx / 2, hd.y, { steps: 6 })
        await page.mouse.move(hd.x + dx, hd.y, { steps: 6 })
        await page.mouse.up()
        await sleep(300)
    }

    describe("updateMode為'update'(就地更新)", function() {

        let spec = { hasMode: true, mode: 'update' }

        it('保留圖例隱藏: 點圖例隱藏s1後父層改標題, s1仍隱藏、s2仍顯示', async function() {
            let { page, context, logs } = await open('hc', spec)
            await hideLegend0(page)
            assert.deepStrictEqual((await state(page)).visible, [false, true])
            await changeTitle(page)
            assert.deepStrictEqual((await state(page)).visible, [false, true])
            assert.deepStrictEqual(logs, [])
            await context.close()
        })

        it('保留縮放: 框選縮放後父層改標題, x軸範圍不變且「重設縮放」按鈕仍在', async function() {
            let { page, context, logs } = await open('hc', spec)
            let s0 = await state(page)
            await zoomDrag(page)
            let sZ = await state(page)
            assert.strictEqual(sZ.hasResetZoom, true)
            assert.ok(sZ.xMin > s0.xMin && sZ.xMax < s0.xMax, '前提: 框選後x軸已縮小')
            await changeTitle(page)
            let sB = await state(page)
            assert.strictEqual(sB.xMin, sZ.xMin)
            assert.strictEqual(sB.xMax, sZ.xMax)
            assert.strictEqual(sB.hasResetZoom, true)
            assert.deepStrictEqual(logs, [])
            await context.close()
        })

        it('保留Highstock導覽列範圍: 拖左把手後父層改標題, x軸範圍不變', async function() {
            let { page, context, logs } = await open('hs', spec)
            let s0 = await state(page)
            await dragHandle(page, 80)
            let sD = await state(page)
            assert.ok(sD.xMin > s0.xMin, '前提: 拖曳後起點右移')
            await changeTitle(page)
            let sB = await state(page)
            assert.strictEqual(sB.xMin, sD.xMin)
            assert.strictEqual(sB.xMax, sD.xMax)
            assert.deepStrictEqual(logs, [])
            await context.close()
        })

        it('不保留點選取: 真滑鼠點資料點選取後父層改標題, 選取遺失', async function() {
            let { page, context, logs } = await open('hc', spec)
            let g = await geo(page)
            let p = g.points[0][5]
            await page.mouse.move(p.x, p.y, { steps: 4 })
            await page.mouse.click(p.x, p.y)
            await sleep(150)
            assert.strictEqual((await state(page)).selected, 1, '前提: 點擊後已選取1點')
            await changeTitle(page)
            assert.strictEqual((await state(page)).selected, 0)
            assert.deepStrictEqual(logs, [])
            await context.close()
        })

    })

    //預設(未給)、'rebuild'與非預期值皆為重建
    let rebuildSpecs = [
        ['未給updateMode(預設)', { hasMode: false }],
        ["'rebuild'", { hasMode: true, mode: 'rebuild' }],
        ['null', { hasMode: true, mode: null }],
        ["空字串''", { hasMode: true, mode: '' }],
        ["未知字串'foo'", { hasMode: true, mode: 'foo' }],
        ["大小寫不同'Update'", { hasMode: true, mode: 'Update' }],
        ["前後空白' update'", { hasMode: true, mode: ' update' }],
        ['數字1', { hasMode: true, mode: 1 }],
        ['布林true', { hasMode: true, mode: true }],
        ['物件{}', { hasMode: true, mode: {} }],
    ]

    describe('預設與非預期值(視為未給, 用預設rebuild)為重建', function() {

        for (let [name, spec] of rebuildSpecs) {

            it(`${name}: 圖例隱藏與框選縮放於父層改標題後重置(與新建相同)`, async function() {
                let { page, context, logs } = await open('hc', spec)
                let s0 = await state(page)
                await hideLegend0(page)
                await zoomDrag(page)
                let sZ = await state(page)
                assert.deepStrictEqual(sZ.visible, [false, true], '前提: s1已隱藏')
                assert.strictEqual(sZ.hasResetZoom, true, '前提: 已縮放')
                await changeTitle(page)
                let sB = await state(page)
                assert.deepStrictEqual(sB.visible, [true, true])
                assert.strictEqual(sB.hasResetZoom, false)
                assert.strictEqual(sB.xMin, s0.xMin)
                assert.strictEqual(sB.xMax, s0.xMax)
                assert.deepStrictEqual(logs, [])
                await context.close()
            })

        }

        it('預設: Highstock導覽列範圍於父層改標題後重置為全範圍(與新建相同)', async function() {
            let { page, context, logs } = await open('hs', { hasMode: false })
            let s0 = await state(page)
            await dragHandle(page, 80)
            assert.ok((await state(page)).xMin > s0.xMin, '前提: 拖曳後起點右移')
            await changeTitle(page)
            let sB = await state(page)
            assert.strictEqual(sB.xMin, s0.xMin)
            assert.strictEqual(sB.xMax, s0.xMax)
            assert.deepStrictEqual(logs, [])
            await context.close()
        })

    })

    describe("updateMode為'update'時文件(prop說明、genComponent說明)所列已知差異於Highcharts 11.4.8屬實", function() {

        //此組案例為文件主張之驗證: 某案變綠=Highcharts已修正該差異, 須回頭修正文件, 不是回歸
        let known = async (id) => {
            let c = await flow.openCase(browser)
            c.r = await c.page.evaluate((i) => window.HCT_run(i, { hasMode: true, mode: 'update' }), id)
            return c
        }
        let ax = (s, coll) => s.axes.find((a) => a.coll === coll && !a.internal)

        it('(1)update為合併: 設定A給yAxis.max為3、B省略, 更新後軸上限仍為3(新建為未設定)', async function() {
            let { context, r } = await known('hc-max3-removed')
            assert.strictEqual(ax(r.updated, 'yAxis').opt.max, 3)
            assert.strictEqual(ax(r.fresh, 'yAxis').opt.max, undefined)
            await context.close()
        })

        it('(2)刻度間隔可能與新建不同: 只改系列名稱, y軸刻度間隔與新建不同', async function() {
            let { context, r } = await known('hc-series-name-change')
            assert.notStrictEqual(ax(r.updated, 'yAxis').tickInterval, ax(r.fresh, 'yAxis').tickInterval)
            await context.close()
        })

        it('(4)Highstock強制選項失效: 設定帶startOnTick為true, 更新後xAxis.startOnTick為true(新建為false)', async function() {
            let { context, r } = await known('hs-startontick-same')
            assert.strictEqual(ax(r.updated, 'xAxis').opt.startOnTick, true)
            assert.strictEqual(ax(r.fresh, 'xAxis').opt.startOnTick, false)
            await context.close()
        })

        it('(5)navigator開關: 無navigator建圖後更新為啟用, 導覽列不出現(新建有導覽列)', async function() {
            let { context, r } = await known('hs-navigator-on')
            assert.strictEqual(r.updated.navigator, null)
            assert.ok(r.fresh.navigator)
            await context.close()
        })

        it('(6)格線群組排到圖框之後: 每次更新後格線群組在圖框之後(新建在其前)', async function() {
            for (let id of ['hc-border-order', 'hc-border-order-dataonly', 'hs-border-order']) {
                let { context, r } = await known(id)
                assert.ok(r.updated.order.gridsAfterBorder > 0, id)
                assert.strictEqual(r.fresh.order.gridsAfterBorder, 0, id)
                await context.close()
            }
        })

        it("'update'之場景清單與宿主頁一致(確認所用案例存在)", async function() {
            let { page, context } = await flow.openCase(browser)
            let ids = await page.evaluate(() => window.HCT_SCEN.map((s) => s.id))
            await context.close()
            for (let id of ['hc-max3-removed', 'hc-series-name-change', 'hs-startontick-same', 'hs-navigator-on', 'hc-border-order', 'hc-border-order-dataonly', 'hs-border-order']) {
                assert.ok(ids.includes(id) && SCEN_IDS.includes(id), id)
            }
        })

    })

})
