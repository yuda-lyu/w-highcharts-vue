import assert from 'assert'
import genComponent from '../src/js/genComponent.mjs'
import getUpdateMode from '../src/js/getUpdateMode.mjs'
import trackResizeObserver from '../src/js/trackResizeObserver.mjs'


//FakeRO, 以全域window.ResizeObserver模擬瀏覽器之ResizeObserver(node無DOM), 記錄建立與disconnect
class FakeRO {
    constructor(callback) {
        this.callback = callback
        this.disconnected = false
        FakeRO.all.push(this)
    }
    observe() {}
    disconnect() {
        this.disconnected = true
    }
}
FakeRO.all = []


//mkEnv, 以假Highcharts建構函數建立組件並模擬vm(取組件之methods與options watcher, $el為假元素)
//假建構函數如Highcharts.Chart onload之setReflow, 建圖時無條件new window.ResizeObserver(); opt.hasLoaded為false時模擬圖片非同步載入(setReflow於建構函數回傳後才被呼叫)
function mkEnv(opt = {}) {
    let calls = []
    let charts = []
    let ctorFail = { v: false }
    let ctor = (el, o) => {
        if (ctorFail.v) {
            throw new Error('ctor fail')
        }
        let chart = {
            id: charts.length + 1,
            opt: o,
            hasLoaded: opt.hasLoaded !== false,
            chartWidth: 500,
            chartHeight: 300,
            destroyed: false,
            destroy() {
                this.destroyed = true
                calls.push('destroy#' + this.id)
            },
            update(...args) {
                calls.push(['update#' + this.id, ...args])
            },
            setReflow() {
                new window.ResizeObserver(() => {}).observe(el)
            },
        }
        if (chart.hasLoaded) {
            chart.setReflow()
        }
        charts.push(chart)
        calls.push('create#' + chart.id)
        return chart
    }
    let comp = genComponent('Highcharts', { chart: ctor })
    let vm = Object.assign({ $el: {}, options: opt.options || {}, updateMode: opt.updateMode, resizeOpt: false }, comp.methods)
    let handler = comp.watch.options.handler
    return {
        comp,
        vm,
        calls,
        charts,
        ctorFail,
        mount: () => comp.mounted.call(vm),
        change: (nv, ov) => handler.call(vm, nv, ov),
        destroy: () => comp.beforeDestroy.call(vm),
    }
}


describe('getUpdateMode', function() {

    it("'update'為就地更新, 'rebuild'為重建", function() {
        assert.strictEqual(getUpdateMode('update'), 'update')
        assert.strictEqual(getUpdateMode('rebuild'), 'rebuild')
    })

    it("未給、非字串、未知字串(含大小寫不同、前後空白)視為未給, 改用預設'rebuild', 不報錯", function() {
        for (let v of [undefined, null, '', 'Update', 'UPDATE', ' update', 'update ', 'rebuilt', 'patch', 0, 1, true, false, {}, [], ['update'], () => 'update', Symbol('update'), NaN]) {
            assert.strictEqual(getUpdateMode(v), 'rebuild', String(typeof v))
        }
    })

})


describe('trackResizeObserver', function() {

    let winOld
    before(function() {
        winOld = global.window
    })
    after(function() {
        global.window = winOld
    })
    beforeEach(function() {
        FakeRO.all = []
        global.window = { ResizeObserver: FakeRO }
    })

    it('收集fn期間建立之ResizeObserver實例(原生實例、instanceof不變), 回傳fn之回傳值, 並還原window.ResizeObserver', function() {
        let list = []
        let r = trackResizeObserver(() => {
            let a = new window.ResizeObserver(() => {})
            let b = new window.ResizeObserver(() => {})
            assert.ok(a instanceof FakeRO)
            assert.notStrictEqual(a, b)
            return 'ret'
        }, list)
        assert.strictEqual(r, 'ret')
        assert.strictEqual(list.length, 2)
        assert.deepStrictEqual(list, FakeRO.all)
        assert.strictEqual(window.ResizeObserver, FakeRO)
    })

    it('fn期間之外建立者不收集', function() {
        let list = []
        new window.ResizeObserver(() => {})
        trackResizeObserver(() => {}, list)
        new window.ResizeObserver(() => {})
        assert.strictEqual(list.length, 0)
        assert.strictEqual(FakeRO.all.length, 2)
    })

    it('fn拋錯時仍還原window.ResizeObserver並將錯誤往外拋', function() {
        let list = []
        assert.throws(() => {
            trackResizeObserver(() => {
                new window.ResizeObserver(() => {})
                throw new Error('boom')
            }, list)
        }, /boom/)
        assert.strictEqual(window.ResizeObserver, FakeRO)
        assert.strictEqual(list.length, 1)
    })

    it('無ResizeObserver或無window時直接執行fn', function() {
        global.window = {}
        assert.strictEqual(trackResizeObserver(() => 1, []), 1)
        delete global.window
        assert.strictEqual(trackResizeObserver(() => 2, []), 2)
    })

})


describe('genComponent: updateMode與重建', function() {

    let winOld
    before(function() {
        winOld = global.window
    })
    after(function() {
        global.window = winOld
    })
    beforeEach(function() {
        FakeRO.all = []
        global.window = { ResizeObserver: FakeRO, cancelAnimationFrame: () => {} }
    })

    it('prop updateMode預設為rebuild, 且不宣告type(非預期輸入不使Vue報警)', function() {
        let { comp } = mkEnv()
        assert.strictEqual(comp.props.updateMode.default, 'rebuild')
        assert.strictEqual(comp.props.updateMode.type, undefined)
    })

    it('預設: options變更即重建(先disconnect舊圖之ResizeObserver再destroy, 再以cloneOptNoReflow(新設定)建新圖), 不呼叫chart.update', function() {
        let e = mkEnv({ options: { series: [{ data: [1] }] } })
        e.mount()
        assert.deepStrictEqual(e.calls, ['create#1'])
        let nv = { chart: { type: 'bar' }, series: [{ data: [2] }] }
        e.change(nv, e.vm.options)
        assert.deepStrictEqual(e.calls, ['create#1', 'destroy#1', 'create#2'])
        assert.strictEqual(e.charts[0].destroyed, true)
        assert.strictEqual(e.vm.chart, e.charts[1])
        assert.deepStrictEqual(e.charts[1].opt, { chart: { type: 'bar', reflow: false }, series: [{ data: [2] }] })
        assert.strictEqual(FakeRO.all.length, 2)
        assert.strictEqual(FakeRO.all[0].disconnected, true)
        assert.strictEqual(FakeRO.all[1].disconnected, false)
    })

    it('重建N次後, 建立之ResizeObserver為N+1個, 其中僅現行圖者未disconnect(存活不隨次數增長), 銷毀組件後皆disconnect', function() {
        let e = mkEnv()
        e.mount()
        for (let i = 0; i < 30; i++) {
            e.change({ series: [{ data: [i] }] }, { series: [{ data: [i - 1] }] })
        }
        assert.strictEqual(FakeRO.all.length, 31)
        assert.strictEqual(FakeRO.all.filter((ro) => !ro.disconnected).length, 1)
        assert.strictEqual(e.charts.filter((c) => !c.destroyed).length, 1)
        e.destroy()
        assert.strictEqual(FakeRO.all.filter((ro) => !ro.disconnected).length, 0)
        assert.strictEqual(e.vm.chart, null)
        assert.strictEqual(e.charts.filter((c) => !c.destroyed).length, 0)
    })

    it('建圖後window.ResizeObserver已還原為原生', function() {
        let e = mkEnv()
        e.mount()
        e.change({ a: 1 }, { a: 0 })
        assert.strictEqual(window.ResizeObserver, FakeRO)
    })

    it("內容相同之新物件(isPropUnchanged)不更新也不重建, 'rebuild'與'update'皆然", function() {
        for (let um of [undefined, 'rebuild', 'update']) {
            let e = mkEnv({ options: { series: [{ data: [1, 2] }] }, updateMode: um })
            e.mount()
            e.change({ series: [{ data: [1, 2] }] }, { series: [{ data: [1, 2] }] })
            assert.deepStrictEqual(e.calls, ['create#1'], String(um))
        }
    })

    it("updateMode為'update': 維持就地更新, 以cloneOptNoReflow(新設定)呼叫chart.update(opt, true, true), 不destroy不重建", function() {
        let e = mkEnv({ options: { series: [{ data: [1] }] }, updateMode: 'update' })
        e.mount()
        let nv = { series: [{ data: [2] }] }
        e.change(nv, e.vm.options)
        assert.deepStrictEqual(e.calls, ['create#1', ['update#1', { chart: { reflow: false }, series: [{ data: [2] }] }, true, true]])
        assert.strictEqual(e.vm.chart, e.charts[0])
        assert.strictEqual(FakeRO.all.length, 1)
        assert.strictEqual(FakeRO.all[0].disconnected, false)
        e.destroy()
        assert.strictEqual(FakeRO.all[0].disconnected, true)
        assert.strictEqual(e.charts[0].destroyed, true)
    })

    it("updateMode為非預期值(非字串、未知字串)依K3視為未給, 用預設'rebuild'重建, 不報錯", function() {
        for (let v of [null, '', 'Update', ' update', 'foo', 1, true, {}, []]) {
            let e = mkEnv({ updateMode: v })
            e.mount()
            e.change({ a: 1 }, { a: 0 })
            assert.deepStrictEqual(e.calls, ['create#1', 'destroy#1', 'create#2'], String(typeof v) + ':' + String(v))
        }
    })

    it('重建與就地更新後皆以新refreshKey更換resizeOpt(使v-domresize重新比較), reflow給false時為false', function() {
        for (let um of ['rebuild', 'update']) {
            let e = mkEnv({ updateMode: um })
            e.mount()
            let k0 = e.vm.resizeOpt.refreshKey
            assert.ok(k0 >= 1)
            e.change({ a: 1 }, { a: 0 })
            assert.ok(e.vm.resizeOpt.refreshKey > k0, um)
            e.change({ chart: { reflow: false } }, { a: 1 })
            assert.strictEqual(e.vm.resizeOpt, false, um)
        }
    })

    it('重建時chartInfo依新設定更新(固定寬高與百分比高度)', function() {
        let e = mkEnv({ options: {} })
        e.mount()
        assert.strictEqual(e.vm.chartInfo.fixedHeight, false)
        e.change({ chart: { height: '60%' } }, {})
        assert.strictEqual(e.vm.chartInfo.fixedHeight, true)
        assert.strictEqual(e.vm.chartInfo.heightByWidth, true)
    })

    it('重建時取消尚未執行之sizeFrame(requestAnimationFrame)', function() {
        let e = mkEnv()
        e.mount()
        let cancelled = []
        window.cancelAnimationFrame = (id) => cancelled.push(id)
        e.vm.sizeFrame = 77
        e.change({ a: 1 }, { a: 0 })
        assert.deepStrictEqual(cancelled, [77])
        assert.strictEqual(e.vm.sizeFrame, null)
    })

    it('尚未掛載或已銷毀時options變更不處理(不建圖)', function() {
        let e = mkEnv()
        e.change({ a: 1 }, { a: 0 })
        assert.deepStrictEqual(e.calls, [])
        e.mount()
        e.destroy()
        e.change({ a: 2 }, { a: 1 })
        assert.deepStrictEqual(e.calls, ['create#1', 'destroy#1'])
    })

    it('重建時建構函數拋錯: 舊圖已釋放且vm.chart為null, window.ResizeObserver仍還原; 其後設定變更可重建恢復(不卡死)', function() {
        let e = mkEnv()
        e.mount()
        e.ctorFail.v = true
        assert.throws(() => e.change({ bad: 1 }, { a: 0 }), /ctor fail/)
        assert.strictEqual(e.vm.chart, null)
        assert.strictEqual(e.charts[0].destroyed, true)
        assert.strictEqual(window.ResizeObserver, FakeRO)
        e.ctorFail.v = false
        e.change({ ok: 1 }, { bad: 1 })
        assert.strictEqual(e.vm.chart, e.charts[1])
        assert.strictEqual(e.charts[1].destroyed, false)
    })

    it("updateMode為'update'但先前建圖失敗致無圖表時, 改以重建恢復", function() {
        let e = mkEnv({ updateMode: 'update' })
        e.ctorFail.v = true
        assert.throws(() => e.mount(), /ctor fail/)
        assert.strictEqual(e.vm.chart, null)
        e.ctorFail.v = false
        e.change({ ok: 1 }, {})
        assert.strictEqual(e.vm.chart, e.charts[0])
    })

    it('圖片非同步載入(建構函數回傳時chart.hasLoaded為false), 載入完成才呼叫setReflow所建立之ResizeObserver同樣被收集並於重建時disconnect', function() {
        let e = mkEnv({ hasLoaded: false })
        e.mount()
        assert.strictEqual(FakeRO.all.length, 0)
        e.charts[0].setReflow() //模擬圖片載入完成, Highcharts onload呼叫setReflow
        assert.strictEqual(FakeRO.all.length, 1)
        assert.strictEqual(window.ResizeObserver, FakeRO)
        e.change({ a: 1 }, { a: 0 })
        assert.strictEqual(FakeRO.all[0].disconnected, true)
        assert.strictEqual(e.charts[0].destroyed, true)
    })

})
