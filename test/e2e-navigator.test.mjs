//e2e-navigator: Highstock開導覽列(navigator)時, 設定帶startOnTick/endOnTick為true的圖經一次設定變更後, 以真滑鼠拖導覽列把手、滾輪縮放, 起迄不被捨入至刻度, 且與直接新建之圖逐毫秒相同
//(建議檔〈驗證建議〉2: 開navigator之Highstock圖經一次設定變更後xAxis[0].options.startOnTick仍為false, 拖把手至非整點時間起點不被捨入; Highstock強制選項只在建圖時套用, 見src/js/genComponent.mjs〈chart.update之已知狀況與問題〉第4點)
//比對於同一頁並排兩圖: U為設定A(無startOnTick)建圖後父層改為設定B(startOnTick與endOnTick為true), N為直接以設定B新建; 操作一律為真滑鼠(page.mouse), 父層改變options prop屬setup
import assert from 'assert'
import { launchBrowser, createFlow, sleep } from './tools/e2e-setup.mjs'


let flow = createFlow('navigator')


describe('e2e-navigator：Highstock導覽列與滾輪縮放不被捨入至刻度', function() {

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

    //openPair, 開頁並建立U、N兩圖(各700x360, 一天分鐘資料, 時間軸UTC), 回傳{page, context, logs}
    let openPair = async () => {
        let c = await flow.openCase(browser, { width: 900, height: 900 })
        await c.page.evaluate(async () => {
            let D = window.HCT
            let X0 = 1791129600000 //2026-10-04T16:00:00Z
            let mk = (sot) => {
                let o = {
                    chart: { animation: false, plotBorderColor: '#666', plotBorderWidth: 1 },
                    time: { useUTC: true },
                    title: { text: null },
                    credits: { enabled: false },
                    legend: { enabled: false },
                    rangeSelector: { enabled: false },
                    plotOptions: { series: { animation: false } },
                    xAxis: {},
                    yAxis: { title: { text: null } },
                    series: [{ data: D.genXY(1440, 100, 5, X0, 60000) }],
                }
                if (sot) {
                    o.xAxis.startOnTick = true
                    o.xAxis.endOnTick = true
                }
                return o
            }
            let elU = D.mkDiv(700, 360)
            let elN = D.mkDiv(700, 360)
            let U = await D.make('hs', mk(false), elU, undefined, false)
            await U.update(mk(true)) //A(無startOnTick) -> B(startOnTick與endOnTick為true), 內容之改變僅此
            let N = await D.make('hs', mk(true), elN, undefined, false)
            await D.sleep(200)
            window.__p = { U, N }
        })
        return c
    }

    let geo = (page, which) => page.evaluate((w) => window.HCT.geo(window.__p[w].chart), which)
    let state = (page, which) => page.evaluate((w) => window.HCT.state(window.__p[w].chart), which)

    //dragHandle, 真滑鼠拖左側導覽列把手向右dx px(分段移動)
    let dragHandle = async (page, which, dx) => {
        let g = await geo(page, which)
        let hd = g.handles[0]
        assert.ok(hd, `${which} 找不到導覽列把手`)
        await page.mouse.move(hd.x, hd.y)
        await page.mouse.down()
        await page.mouse.move(hd.x + dx / 2, hd.y, { steps: 6 })
        await page.mouse.move(hd.x + dx, hd.y, { steps: 6 })
        await page.mouse.up()
        await sleep(400)
    }

    //wheelZoom, 真滑鼠移至繪圖區40%處後滾輪向上(縮放)
    let wheelZoom = async (page, which) => {
        let g = await geo(page, which)
        await page.mouse.move(g.plot.x + g.plot.w * 0.4, g.plot.y + g.plot.h * 0.5)
        await page.mouse.wheel(0, -400)
        await sleep(400)
    }

    it('設定變更後xAxis[0].options.startOnTick與endOnTick仍為false(開navigator時之強制選項不失效), 與新建相同', async function() {
        let { page, context, logs } = await openPair()
        let sU = await state(page, 'U')
        let sN = await state(page, 'N')
        assert.strictEqual(sN.startOnTick, false) //新建之圖為基準
        assert.strictEqual(sN.endOnTick, false)
        assert.strictEqual(sU.startOnTick, false) //〈驗證建議2〉
        assert.strictEqual(sU.endOnTick, false)
        assert.deepStrictEqual(logs, [])
        await context.close()
    })

    it('真滑鼠拖導覽列左把手+83px, 起點不被捨入至刻度, 與新建之圖逐毫秒相同', async function() {
        let { page, context, logs } = await openPair()
        await dragHandle(page, 'N', 83)
        await dragHandle(page, 'U', 83)
        let sN = await state(page, 'N')
        let sU = await state(page, 'U')
        assert.strictEqual(sN.xMinOnTick, false) //基準: 新建之圖拖到非整點時間
        assert.strictEqual(sU.xMinOnTick, false) //〈驗證建議2〉拖把手至非整點時間, 起點不被捨入
        assert.strictEqual(sU.xMin, sN.xMin)
        assert.strictEqual(sU.xMax, sN.xMax)
        assert.deepStrictEqual(logs, [])
        await context.close()
    })

    it('真滑鼠滾輪縮放(游標於繪圖區40%處), 起迄不被捨入至刻度, 與新建之圖逐毫秒相同', async function() {
        let { page, context, logs } = await openPair()
        await wheelZoom(page, 'N')
        await wheelZoom(page, 'U')
        let sN = await state(page, 'N')
        let sU = await state(page, 'U')
        assert.strictEqual(sN.xMinOnTick, false)
        assert.strictEqual(sU.xMinOnTick, false) //〈驗證建議2〉滾輪縮放後起點不被捨入
        assert.ok(sU.xMin > sN.xMin - 1 && sU.xMin < sN.xMin + 1, `${sU.xMin} ${sN.xMin}`)
        assert.ok(sU.xMax > sN.xMax - 1 && sU.xMax < sN.xMax + 1, `${sU.xMax} ${sN.xMax}`)
        assert.deepStrictEqual(logs, [])
        await context.close()
    })

})
