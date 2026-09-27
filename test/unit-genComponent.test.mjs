import assert from 'assert'
import getContainerSize from '../src/js/getContainerSize.mjs'
import isPropUnchanged from '../src/js/isPropUnchanged.mjs'
import getChartOptInfo from '../src/js/getChartOptInfo.mjs'
import cloneOptNoReflow from '../src/js/cloneOptNoReflow.mjs'


describe('getContainerSize', function() {

    //getComputedStyle以元素之__style模擬(node無DOM)
    let winOld
    before(function() {
        winOld = global.window
        global.window = { getComputedStyle: (el) => el.__style || {} }
    })
    after(function() {
        global.window = winOld
    })
    let mk = (o) => ({
        offsetWidth: o.w,
        scrollWidth: o.sw !== undefined ? o.sw : o.w,
        offsetHeight: o.h,
        scrollHeight: o.sh !== undefined ? o.sh : o.h,
        getBoundingClientRect: () => ({ width: o.rw !== undefined ? o.rw : o.w }),
        __style: o.style || {},
    })

    it('寬高扣除padding, 與Highcharts之getStyle量測方式相同', function() {
        assert.deepStrictEqual(getContainerSize(mk({ w: 1000, h: 400, style: { paddingLeft: '20px', paddingRight: '20px', paddingTop: '10px', paddingBottom: '0px' } })), { width: 960, height: 390 })
    })

    it('寬度取offsetWidth與scrollWidth之小者', function() {
        assert.deepStrictEqual(getContainerSize(mk({ w: 1002, sw: 1000, h: 400 })), { width: 1000, height: 400 })
    })

    it('外框寬為小數時(offsetWidth進位)改以getBoundingClientRect取整, 與圖表chartWidth一致', function() {
        assert.deepStrictEqual(getContainerSize(mk({ w: 1000, rw: 999.5, h: 400 })), { width: 999, height: 400 })
    })

    it('padding大於外框時為0, 不回傳負數', function() {
        assert.deepStrictEqual(getContainerSize(mk({ w: 30, h: 0, style: { paddingLeft: '20px', paddingRight: '20px' } })), { width: 0, height: 0 })
    })

})


describe('isPropUnchanged', function() {

    it('內容相同之不同物件(模板物件字面值)視為未變更', function() {
        assert.strictEqual(isPropUnchanged({ series: [{ data: [1, 2] }] }, { series: [{ data: [1, 2] }] }), true)
    })

    it('同一物件參照視為已變更(deep watcher偵測到內部異動, 如push資料點)', function() {
        let o = { series: [{ data: [1, 2] }] }
        assert.strictEqual(isPropUnchanged(o, o), false)
    })

    it('內容不同之物件視為已變更', function() {
        assert.strictEqual(isPropUnchanged({ series: [{ data: [1, 2] }] }, { series: [{ data: [1, 3] }] }), false)
    })

})


describe('getChartOptInfo', function() {

    it('未給chart時: 同步尺寸、寬高不固定', function() {
        assert.deepStrictEqual(getChartOptInfo({}), { reflow: true, fixedWidth: false, fixedHeight: false, heightByWidth: false })
        assert.deepStrictEqual(getChartOptInfo(), { reflow: true, fixedWidth: false, fixedHeight: false, heightByWidth: false })
    })

    it('chart.reflow給false時不同步尺寸', function() {
        assert.strictEqual(getChartOptInfo({ chart: { reflow: false } }).reflow, false)
    })

    it('chart.width、height有給(數字)時該維度固定', function() {
        let r = getChartOptInfo({ chart: { width: 500, height: 300 } })
        assert.strictEqual(r.fixedWidth, true)
        assert.strictEqual(r.fixedHeight, true)
        assert.strictEqual(r.heightByWidth, false)
    })

    it('chart.width、height為null時不固定(Highcharts以null表示依容器)', function() {
        let r = getChartOptInfo({ chart: { width: null, height: null } })
        assert.strictEqual(r.fixedWidth, false)
        assert.strictEqual(r.fixedHeight, false)
    })

    it('chart.height為百分比字串時高度隨寬度變化', function() {
        let r = getChartOptInfo({ chart: { height: '60%' } })
        assert.strictEqual(r.fixedHeight, true)
        assert.strictEqual(r.heightByWidth, true)
    })

})


describe('cloneOptNoReflow', function() {

    it('回傳深層複本並關閉chart.reflow, 不改動原物件', function() {
        let o = { chart: { type: 'line' }, series: [{ data: [1, 2] }] }
        let r = cloneOptNoReflow(o)
        assert.deepStrictEqual(r, { chart: { type: 'line', reflow: false }, series: [{ data: [1, 2] }] })
        assert.deepStrictEqual(o, { chart: { type: 'line' }, series: [{ data: [1, 2] }] })
        assert.notStrictEqual(r.series, o.series)
    })

    it('函數(例如formatter)保留原參照', function() {
        let fmt = function() {
            return 'x'
        }
        let r = cloneOptNoReflow({ tooltip: { formatter: fmt } })
        assert.strictEqual(r.tooltip.formatter, fmt)
    })

    it('未給設定物件時回傳僅含chart.reflow之物件', function() {
        assert.deepStrictEqual(cloneOptNoReflow(), { chart: { reflow: false } })
        assert.deepStrictEqual(cloneOptNoReflow(null), { chart: { reflow: false } })
    })

})
