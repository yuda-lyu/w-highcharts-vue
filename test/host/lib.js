/* e2e宿主頁之頁內函式庫: 以元件(w-highcharts-vue、w-highstock-vue)建圖、更新、快照與比對.
 * 宿主頁扮演父層頁面, 父層改變options prop屬setup(父層行為); 使用者互動(滑鼠、滾輪、圖例)由測試以真滑鼠進行.
 * 快照(snap)與比對(diff)取自hc33調研(sgud/exp/experience.md)之「就地更新 vs 新建」並排比對驗證器 */
(function(w) {

    var sleep = function(ms) {
        return new Promise(function(r) { setTimeout(r, ms) })
    }

    //deep clone, 保留函數與undefined鍵
    function clone(o) {
        if (Array.isArray(o)) {
            return o.map(clone)
        }
        if (o && typeof o === 'object') {
            var r = {}
            Object.keys(o).forEach(function(k) {
                r[k] = clone(o[k])
            })
            return r
        }
        return o
    }

    //merge(僅供組建測試設定)
    function merge(a, b) {
        if (b === undefined) {
            return clone(a)
        }
        var r = clone(a)
        Object.keys(b || {}).forEach(function(k) {
            var v = b[k]
            if (v && typeof v === 'object' && !Array.isArray(v) && r[k] && typeof r[k] === 'object' && !Array.isArray(r[k])) {
                r[k] = merge(r[k], v)
            }
            else {
                r[k] = clone(v)
            }
        })
        return r
    }

    //確定性資料
    function genY(n, amp, seed) {
        var a = []
        var s = seed || 1
        for (var i = 0; i < n; i++) {
            s = (s * 9301 + 49297) % 233280
            a.push(Math.round(((s / 233280) * 2 - 1) * amp * 100) / 100)
        }
        return a
    }
    function genXY(n, amp, seed, x0, dx) {
        var ys = genY(n, amp, seed)
        return ys.map(function(y, i) { return [x0 + i * dx, y] })
    }

    var seq = 0
    function mkDiv(w_, h_) {
        var d = document.createElement('div')
        d.id = 'c' + (++seq)
        d.style.cssText = 'width:' + (w_ || 600) + 'px;height:' + (h_ || 300) + 'px;position:relative;margin:4px;background:#fff;'
        document.body.appendChild(d)
        return d
    }

    function findChart(vm) {
        if (vm.chart) {
            return vm.chart
        }
        for (var i = 0; i < vm.$children.length; i++) {
            var c = findChart(vm.$children[i])
            if (c) {
                return c
            }
        }
        return null
    }

    //make: 以元件建圖, kind為hc|hs; 回傳{vm, el, chart(取最新), update(B), destroy()}
    //updateMode有給(含非預期值)才傳入元件, 未給則不傳(使用元件預設)
    async function make(kind, opts, el, updateMode, hasUpdateMode) {
        var cmp = kind === 'hs' ? 'w-highstock-vue' : 'w-highcharts-vue'
        var host = document.createElement('div')
        el.appendChild(host)
        var vm = new w.Vue({
            el: host,
            data: { opts: opts, mode: updateMode },
            render: function(h) {
                var props = { options: this.opts }
                if (hasUpdateMode) {
                    props.updateMode = this.mode
                }
                return h(cmp, { props: props, style: { width: el.style.width, height: el.style.height } })
            },
        })
        await sleep(60)
        return {
            el: el,
            vm: vm,
            get chart() {
                return findChart(vm)
            },
            update: async function(B) {
                vm.opts = clone(B)
                await sleep(120)
            },
            destroy: function() {
                vm.$destroy()
            },
        }
    }

    //快照
    function axSnap(a) {
        var o = a.options || {}
        return {
            coll: a.coll,
            internal: !!o.isInternal,
            index: o.index,
            min: a.min,
            max: a.max,
            dataMin: a.dataMin,
            dataMax: a.dataMax,
            userMin: a.userMin,
            userMax: a.userMax,
            tickInterval: a.tickInterval,
            tickPositions: a.tickPositions ? a.tickPositions.slice() : null,
            minorTicks: a.minorTickInterval,
            opt: {
                startOnTick: o.startOnTick,
                endOnTick: o.endOnTick,
                min: o.min,
                max: o.max,
                softMin: o.softMin,
                softMax: o.softMax,
                tickInterval: o.tickInterval,
                tickAmount: o.tickAmount,
                minRange: o.minRange,
                floor: o.floor,
                ceiling: o.ceiling,
                gridLineColor: o.gridLineColor,
                gridZIndex: o.gridZIndex,
            },
            uopt: {
                startOnTick: a.userOptions && a.userOptions.startOnTick,
                endOnTick: a.userOptions && a.userOptions.endOnTick,
                min: a.userOptions && a.userOptions.min,
                max: a.userOptions && a.userOptions.max,
            },
        }
    }

    //SVG根下子節點順序: 圖框(plot-border)與格線群組(grid)之DOM索引
    function domOrder(chart) {
        var kids = Array.prototype.slice.call(chart.renderer.box.children)
        var names = kids.map(function(el) {
            return ((el.getAttribute('class') || el.tagName) + '').replace(/\s+/g, '.')
        })
        var iB = names.findIndex(function(n) { return /highcharts-plot-border/.test(n) })
        var iG = []
        names.forEach(function(n, i) { if (/highcharts-grid(\.|$)/.test(n) && !/minor/.test(n)) { iG.push(i) } })
        return {
            names: names,
            idxBorder: iB,
            idxGrids: iG,
            gridsAfterBorder: iG.filter(function(i) { return i > iB }).length,
            zBorder: chart.plotBorder ? chart.plotBorder.zIndex : null,
            zGrids: chart.axes.filter(function(a) { return a.gridGroup }).map(function(a) { return a.gridGroup.zIndex }),
        }
    }

    //追蹤: 各軸每次setTickInterval時之axis.len(新建時首次計算刻度之len不同於最終len, 即update與new不等價之成因)
    if (w.Highcharts && w.Highcharts.Axis && !w.Highcharts.Axis.prototype.__hctTraced) {
        var axProto = w.Highcharts.Axis.prototype
        var origSTI = axProto.setTickInterval
        axProto.setTickInterval = function(secondPass) {
            ;(this.__tl = this.__tl || []).push([this.len, !!secondPass])
            return origSTI.apply(this, arguments)
        }
        axProto.__hctTraced = true
    }

    function snap(chart) {
        return {
            chartW: chart.chartWidth,
            chartH: chart.chartHeight,
            plot: [chart.plotLeft, chart.plotTop, chart.plotWidth, chart.plotHeight],
            axes: chart.axes.map(axSnap),
            series: chart.series.map(function(s) {
                return { name: s.name, type: s.type, visible: s.visible, n: s.points ? s.points.length : null, isInternal: !!(s.options && s.options.isInternal) }
            }),
            order: domOrder(chart),
            navigator: chart.navigator ? { enabled: !!chart.navigator.navigatorEnabled, height: chart.navigator.height, scrollbarHeight: chart.navigator.scrollbarHeight, margin: chart.navigator.navigatorOptions && chart.navigator.navigatorOptions.margin, hasObj: true } : null,
            margins: [chart.plotTop, chart.marginRight, chart.marginBottom, chart.plotLeft],
            hasScrollbar: !!chart.scrollbar,
        }
    }

    //deep diff, 回傳路徑差異清單
    function diff(a, b, path, out) {
        out = out || []
        path = path || ''
        if (a === b) {
            return out
        }
        var ta = typeof a
        var tb = typeof b
        if (ta !== tb || a === null || b === null || ta !== 'object') {
            if (ta === 'number' && tb === 'number' && isNaN(a) && isNaN(b)) {
                return out
            }
            out.push({ path: path, updated: a, fresh: b })
            return out
        }
        var keys = {}
        Object.keys(a).forEach(function(k) { keys[k] = 1 })
        Object.keys(b).forEach(function(k) { keys[k] = 1 })
        Object.keys(keys).forEach(function(k) {
            diff(a[k], b[k], path + (path ? '.' : '') + k, out)
        })
        return out
    }

    //geo: 圖表各元素之視窗座標(供測試以真滑鼠操作): 繪圖區、圖例項(文字中心)、Highstock導覽列把手、各系列資料點
    function geo(chart) {
        var r = chart.container.getBoundingClientRect()
        var center = function(el) {
            var b = el.getBoundingClientRect()
            return { x: b.left + b.width / 2, y: b.top + b.height / 2 }
        }
        return {
            plot: { x: r.left + chart.plotLeft, y: r.top + chart.plotTop, w: chart.plotWidth, h: chart.plotHeight },
            legendItems: (chart.legend && chart.legend.allItems ? chart.legend.allItems : []).map(function(it) { return center(it.legendItem.label.element) }),
            handles: chart.navigator && chart.navigator.handles ? chart.navigator.handles.map(function(hd) { return center(hd.element) }) : [],
            points: chart.series.map(function(s) {
                return (s.points || []).map(function(p) { return { x: r.left + chart.plotLeft + p.plotX, y: r.top + chart.plotTop + p.plotY } })
            }),
        }
    }

    //state: 圖表互動狀態(縮放、圖例顯隱、點選取、重設縮放按鈕、軸是否落在刻度上)
    function state(chart) {
        var x = chart.xAxis[0]
        var y = chart.yAxis[0]
        return {
            xMin: x.min,
            xMax: x.max,
            yMin: y.min,
            yMax: y.max,
            xUserMin: x.userMin,
            xUserMax: x.userMax,
            xMinOnTick: x.tickPositions ? x.tickPositions.indexOf(x.min) >= 0 : null,
            startOnTick: x.options.startOnTick,
            endOnTick: x.options.endOnTick,
            visible: chart.series.filter(function(s) { return !(s.options && s.options.isInternal) }).map(function(s) { return s.visible }),
            selected: chart.getSelectedPoints().length,
            hasResetZoom: !!chart.resetZoomButton,
        }
    }

    w.HCT = { sleep: sleep, clone: clone, merge: merge, genY: genY, genXY: genXY, mkDiv: mkDiv, make: make, snap: snap, diff: diff, domOrder: domOrder, findChart: findChart, geo: geo, state: state }

})(window)
