//e2e-geo-like: 使用端確認——w-geo-vue之WSptLiqPlotDepth(液化分析頁深度剖線圖)型設定(Gitea #33, 建議檔〈緣由〉使用端液化分析頁E2E-011~015、019)
//重現: 使用者切換參數(FS圖yAxis.max為3換為其他參數之圖無max)、寬高滑桿、繪圖型態、隱藏深度軸標題、深度範圍改變; 每次重算options皆含新函數(labels.formatter), 故每次皆視為已變更;
//w-geo-vue以索引為key重用圖元件(WSptLiqPlotDepths.vue :key="'kst-'+kst"), 同一圖元件依序被餵入不同參數之設定
//設定形狀見test/host/geo.js(取自w-geo-vue只讀參照, 未修改該套件); 預設模式下每次改設定後之圖須與直接以該設定新建者相同(語意快照、像素、框線不被格線蓋住、無殘留max為3)
import assert from 'assert'
import { launchBrowser, createFlow, comparePair } from './tools/e2e-setup.mjs'


let flow = createFlow('geo-like')

let GEO_IDS = ['geo-fs-to-nonfs', 'geo-nonfs-to-fs', 'geo-chain', 'geo-size-slider', 'geo-fs-size-slider', 'geo-plot-type', 'geo-hide-depth-title', 'geo-depth-range']


describe('e2e-geo-like：w-geo-vue型設定切換後之圖等同新建', function() {

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

    let run = async (id, opt) => {
        let c = await flow.openCase(browser, { width: 900, height: 1100 })
        c.r = await c.page.evaluate(([i, o]) => window.HCT_geoRun(i, o || {}), [id, opt])
        return c
    }

    it('場景清單與宿主頁test/host/geo.js一致', async function() {
        let { page, context } = await flow.openCase(browser)
        let ids = await page.evaluate(() => window.HCT_GEO.map((s) => s.id))
        await context.close()
        assert.deepStrictEqual(ids, GEO_IDS)
    })

    for (let id of GEO_IDS) {

        it(`${id}: 切換後之圖與新建相同, 格線不蓋圖框`, async function() {
            let { page, context, logs, r } = await run(id)
            assert.deepStrictEqual(r.diffs, [], `${id} 更新後與新建之快照不同`)
            assert.strictEqual(r.updated.order.gridsAfterBorder, 0)
            await comparePair(flow, page, r.keepIds[0], r.keepIds[1], `geo-like-${id}`)
            assert.deepStrictEqual(logs, [])
            await context.close()
        })

    }

    it('FS圖(yAxis.max為3)切換為其他參數後, 值軸不殘留max為3: 上限由資料決定且大於3, 與新建相同', async function() {
        let { context, r } = await run('geo-fs-to-nonfs')
        let y = (s) => s.axes.find((a) => a.coll === 'yAxis')
        assert.strictEqual(y(r.updated).opt.max, undefined)
        assert.ok(y(r.updated).max > 3, `值軸上限${y(r.updated).max}`)
        assert.strictEqual(y(r.updated).max, y(r.fresh).max)
        assert.deepStrictEqual(y(r.updated).tickPositions, y(r.fresh).tickPositions)
        await context.close()
    })

    it('其他參數切換為FS圖後, 值軸鎖定為min 0、max 3(options), 實際範圍與刻度和新建相同', async function() {
        let { context, r } = await run('geo-nonfs-to-fs')
        let y = (s) => s.axes.find((a) => a.coll === 'yAxis')
        assert.strictEqual(y(r.updated).opt.min, 0)
        assert.strictEqual(y(r.updated).opt.max, 3)
        assert.strictEqual(y(r.updated).min, y(r.fresh).min)
        assert.strictEqual(y(r.updated).max, y(r.fresh).max) //endOnTick使實際上限進位至刻度, 以新建為準
        assert.deepStrictEqual(y(r.updated).tickPositions, y(r.fresh).tickPositions)
        await context.close()
    })

})
