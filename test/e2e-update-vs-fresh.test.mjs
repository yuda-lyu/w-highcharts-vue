//e2e-update-vs-fresh: 預設模式(updateMode為'rebuild')下, 「設定A建圖→父層改為設定B」與「直接以設定B新建」之結果須相同(Gitea #33, 不變式INV-1「同一份設定恆畫出同一張圖」)
//比對於同一頁並排兩圖(元件實例U依序改變options prop、元件實例N以最後設定直接掛載), 語意快照(各軸min/max/dataMin/dataMax/userMin/userMax/tickInterval/tickPositions/startOnTick/endOnTick、繪圖區幾何、
//系列數與visible、navigator與scrollbar存在與否、格線群組與圖框之DOM順序)逐項相同, 並以pixelmatch比兩圖元素截圖(反鋸齒感知, 容差8px, 觀測雜訊4px)
//斷言註解之〈驗證建議N〉對應建議檔(建議w-highcharts-vue修正.md)〈驗證建議〉之第N點; 場景定義見test/host/scen.js(point欄: 1軸範圍與刻度、2Highstock強制選項、3格線與圖框順序)
import assert from 'assert'
import { SCEN_IDS, launchBrowser, createFlow, comparePair } from './tools/e2e-setup.mjs'


let flow = createFlow('update-vs-fresh')


describe('e2e-update-vs-fresh：預設模式下更新後之圖等同新建', function() {

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

    //runScen, 開頁並執行場景, 回傳{page, context, logs, r}, r.keepIds為[U之div id, N之div id]
    let runScen = async (id, opt) => {
        let c = await flow.openCase(browser)
        c.r = await c.page.evaluate(([i, o]) => window.HCT_run(i, o), [id, opt || {}])
        return c
    }

    it('場景清單與宿主頁test/host/scen.js一致(SCEN_IDS)', async function() {
        let { page, context } = await flow.openCase(browser)
        let ids = await page.evaluate(() => window.HCT_SCEN.map((s) => s.id))
        await context.close()
        assert.deepStrictEqual(ids, SCEN_IDS)
        assert.strictEqual(ids.length, 47)
    })

    //INV-1: 全場景(Highcharts 31個、Highstock 16個), 語意快照逐項相同、像素差在容差內、頁面無錯誤
    for (let id of SCEN_IDS) {

        it(`INV-1 ${id}`, async function() {
            let { page, context, logs, r } = await runScen(id)
            let desc = r.desc
            //〈驗證建議1〉各軸getExtremes/tickPositions/options.startOnTick相同, 並含繪圖區幾何、navigator、格線與圖框順序等全部快照項
            assert.deepStrictEqual(r.diffs, [], `${id}(${desc}) 更新後與新建之快照不同`)
            //〈驗證建議3〉格線群組皆在圖框之下(DOM順序)
            assert.strictEqual(r.updated.order.gridsAfterBorder, 0, `${id} 格線群組排到圖框之後`)
            //像素: 兩圖元素截圖
            await comparePair(flow, page, r.keepIds[0], r.keepIds[1], `update-vs-fresh-${id}`)
            assert.deepStrictEqual(logs, [])
            await context.close()
        })

    }

    //〈驗證建議1〉Highcharts: 同一頁先以A建圖、改為B, 再以B另建同尺寸新圖, x、y軸getExtremes、tickPositions、options.startOnTick完全相同(w-geo-vue切換參數: FS圖max為3、其他圖省略max)
    it('〈驗證建議1〉Highcharts: yAxis.max由3改為省略, 更新後之getExtremes、tickPositions、startOnTick與新建完全相同', async function() {
        let { context, r } = await runScen('hc-max3-removed')
        let axes = (s) => s.axes.filter((a) => !a.internal).map((a) => ({ coll: a.coll, min: a.min, max: a.max, tickPositions: a.tickPositions, startOnTick: a.opt.startOnTick, optMax: a.opt.max }))
        assert.deepStrictEqual(axes(r.updated), axes(r.fresh))
        assert.strictEqual(r.updated.axes.find((a) => a.coll === 'yAxis').opt.max, undefined) //B省略max, 不殘留A之max為3
        await context.close()
    })

    //〈驗證建議1〉新建首算刻度與更新不等價(Highcharts自身行為): 只改系列名稱, 刻度間隔仍須與新建相同
    it('〈驗證建議1〉Highcharts: 只改系列名稱, y軸刻度間隔與新建相同', async function() {
        let { context, r } = await runScen('hc-series-name-change')
        let y = (s) => s.axes.find((a) => a.coll === 'yAxis')
        assert.strictEqual(y(r.updated).tickInterval, y(r.fresh).tickInterval)
        assert.deepStrictEqual(y(r.updated).tickPositions, y(r.fresh).tickPositions)
        await context.close()
    })

    //〈驗證建議2〉Highstock開navigator: 設定帶startOnTick為true, 經一次設定變更後xAxis[0].options.startOnTick仍為false(強制選項不失效)
    it('〈驗證建議2〉Highstock: 設定帶startOnTick為true, 改設定後xAxis[0].options.startOnTick仍為false', async function() {
        for (let id of ['hs-startontick-same', 'hs-startontick-forced', 'hs-data-only-startontick']) {
            let { context, r } = await runScen(id)
            let x = (s) => s.axes.find((a) => a.coll === 'xAxis' && !a.internal)
            assert.strictEqual(x(r.updated).opt.startOnTick, false, `${id} 更新後startOnTick`)
            assert.strictEqual(x(r.updated).opt.endOnTick, false, `${id} 更新後endOnTick`)
            assert.strictEqual(x(r.fresh).opt.startOnTick, false, `${id} 新建startOnTick`)
            await context.close()
        }
    })

    //〈驗證建議3〉設定變更後plotBorder仍在格線群組之後繪製(DOM順序), Highcharts與Highstock; 僅改資料亦然
    it('〈驗證建議3〉設定變更後圖框(plotBorder)在格線群組之後繪製, 圖框索引大於所有格線群組索引', async function() {
        for (let id of ['hc-border-order', 'hc-border-order-dataonly', 'hs-border-order']) {
            let { context, r } = await runScen(id)
            let o = r.updated.order
            assert.ok(o.idxBorder >= 0, `${id} 找不到圖框`)
            assert.ok(o.idxGrids.length > 0, `${id} 找不到格線群組`)
            for (let ig of o.idxGrids) {
                assert.ok(ig < o.idxBorder, `${id} 格線群組索引${ig}不小於圖框索引${o.idxBorder}`)
            }
            assert.deepStrictEqual(o.idxGrids, r.fresh.order.idxGrids)
            assert.strictEqual(o.idxBorder, r.fresh.order.idxBorder)
            await context.close()
        }
    })

})
