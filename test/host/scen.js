/* e2e宿主頁之場景定義: steps=[設定0, 設定1, ...], 以設定0建圖, 依序改變options prop, 再與以最後設定新建之圖並排比對.
 * point: 1為軸範圍與刻度(含被省略之鍵殘留、新建首算軸長、navigator開關), 2為Highstock強制startOnTick/endOnTick, 3為格線群組與圖框順序
 * (成因與Highcharts原始碼位置見src/js/genComponent.mjs之〈chart.update之已知狀況與問題〉) */
(function(w) {
    var D = w.HCT
    var X0 = 1791129600000 //2026-10-04T16:00:00Z
    var DX = 1000

    function hcBase(over, amp, seed) {
        return D.merge({
            chart: { type: 'line', animation: false, plotBorderColor: '#666', plotBorderWidth: 1, marginLeft: 75, marginRight: 5, marginTop: 25, marginBottom: 65, spacing: [0, 0, 0, 0] },
            title: { text: null },
            credits: { enabled: false },
            legend: { enabled: false },
            plotOptions: { series: { animation: false } },
            xAxis: { gridLineColor: '#eeeeee', gridLineWidth: 1 },
            yAxis: { gridLineColor: '#eeeeee', gridLineWidth: 1, title: { text: null } },
            series: [{ data: D.genXY(20, amp === undefined ? 250 : amp, seed || 3, 0, 1) }],
        }, over)
    }

    function hsBase(over, amp, seed) {
        return D.merge({
            chart: { animation: false, plotBorderColor: '#666', plotBorderWidth: 1 },
            time: { useUTC: true },
            title: { text: null },
            credits: { enabled: false },
            legend: { enabled: false },
            rangeSelector: { enabled: false },
            plotOptions: { series: { animation: false } },
            xAxis: { gridLineColor: '#eeeeee', gridLineWidth: 1 },
            yAxis: { gridLineColor: '#eeeeee', gridLineWidth: 1, title: { text: null } },
            series: [{ data: D.genXY(200, amp === undefined ? 250 : amp, seed || 5, X0, DX) }],
        }, over)
    }

    var S = []
    function add(o) { S.push(o) }
    function noMargin(o) { delete o.chart.marginTop; delete o.chart.marginBottom; return o }

    //---- Highcharts(非stock) ----
    add({ id: 'hc-removed-minmax', kind: 'hc', point: 1, desc: 'A: yAxis{min:-200,max:200} -> B: yAxis{}(鍵省略), 資料±250', steps: [hcBase({ yAxis: { min: -200, max: 200 } }), hcBase({})] })
    add({ id: 'hc-undefined-minmax', kind: 'hc', point: 1, desc: 'A: yAxis{min:-200,max:200} -> B: 顯式undefined', steps: [hcBase({ yAxis: { min: -200, max: 200 } }), hcBase({ yAxis: { min: undefined, max: undefined } })] })
    add({ id: 'hc-null-minmax', kind: 'hc', point: 1, desc: 'A: yAxis{min:-200,max:200} -> B: yAxis{min:null,max:null}', steps: [hcBase({ yAxis: { min: -200, max: 200 } }), hcBase({ yAxis: { min: null, max: null } })] })
    add({ id: 'hc-set-max3', kind: 'hc', point: 1, desc: 'A: 無max(資料±2.9) -> B: yAxis{max:3}', steps: [hcBase({}, 2.9), hcBase({ yAxis: { max: 3 } }, 2.9)] })
    add({ id: 'hc-max3-removed', kind: 'hc', point: 1, desc: 'A: yAxis{max:3} -> B: yAxis{}(資料±2.9), 同w-geo-vue切換參數(FS圖設max:3、其他圖不設)', steps: [hcBase({ yAxis: { max: 3 } }, 2.9), hcBase({}, 2.9)] })
    add({ id: 'hc-tickinterval-removed', kind: 'hc', point: 1, desc: 'A: yAxis{tickInterval:50} -> B: yAxis{}', steps: [hcBase({ yAxis: { tickInterval: 50 } }), hcBase({})] })
    add({ id: 'hc-tickamount-removed', kind: 'hc', point: 1, desc: 'A: yAxis{tickAmount:9} -> B: yAxis{}', steps: [hcBase({ yAxis: { tickAmount: 9 } }), hcBase({})] })
    add({ id: 'hc-softmax-removed', kind: 'hc', point: 1, desc: 'A: yAxis{softMax:500} -> B: yAxis{}', steps: [hcBase({ yAxis: { softMax: 500 } }), hcBase({})] })
    add({ id: 'hc-softmax-undefined', kind: 'hc', point: 1, desc: 'A: yAxis{softMax:500} -> B: yAxis{softMax:undefined}', steps: [hcBase({ yAxis: { softMax: 500 } }), hcBase({ yAxis: { softMax: undefined } })] })
    add({ id: 'hc-data-only-grow', kind: 'hc', point: 1, desc: '僅資料改變(振幅100->250)', steps: [hcBase({}, 100, 3), hcBase({}, 250, 7)] })
    add({ id: 'hc-data-only-shrink', kind: 'hc', point: 1, desc: '僅資料改變(振幅250->100)', steps: [hcBase({}, 250, 3), hcBase({}, 100, 7)] })
    add({
        id: 'hc-userzoom-then-update', kind: 'hc', point: 1, desc: '先xAxis/yAxis setExtremes縮放, 再更新資料(重建後縮放重置、與新建相同)', steps: [hcBase({}, 250, 3), hcBase({}, 250, 7)],
        prep: function(chart) { chart.xAxis[0].setExtremes(5, 12, false); chart.yAxis[0].setExtremes(-50, 50, true) },
    })
    add({ id: 'hc-border-order', kind: 'hc', point: 3, desc: '改gridLineColor一次後格線群組與plotBorder之DOM順序', steps: [hcBase({}), hcBase({ xAxis: { gridLineColor: '#dddddd' }, yAxis: { gridLineColor: '#dddddd' } })] })
    add({ id: 'hc-border-order-dataonly', kind: 'hc', point: 3, desc: '只改資料一次後之DOM順序', steps: [hcBase({}, 100, 3), hcBase({}, 100, 9)] })
    add({ id: 'hc-axes-remove', kind: 'hc', point: 1, desc: 'A: 兩條yAxis -> B: 一條', steps: [hcBase({ yAxis: [{ title: { text: null } }, { title: { text: null }, opposite: true, max: 10 }], series: [{ data: D.genXY(20, 250, 3, 0, 1) }, { yAxis: 1, data: D.genXY(20, 5, 4, 0, 1) }] }), hcBase({})] })
    add({ id: 'hc-inverted', kind: 'hc', point: 1, desc: 'A: chart.inverted:false -> B: inverted:true', steps: [hcBase({}), hcBase({ chart: { inverted: true } })] })
    add({ id: 'hc-categories-removed', kind: 'hc', point: 1, desc: 'A: xAxis.categories -> B: 無categories(w-plot-vue bar類型切換)', steps: [hcBase({ xAxis: { categories: ['a', 'b', 'c', 'd'] }, series: [{ data: [1, 2, 3, 4] }] }), hcBase({ series: [{ data: D.genXY(20, 250, 3, 0, 1) }] })] })
    add({ id: 'hc-plotlines-removed', kind: 'hc', point: 1, desc: 'A: xAxis.plotLines(+min,tickInterval) -> B: 省略', steps: [hcBase({ xAxis: { min: -0.25, tickInterval: 1, plotLines: [{ value: 3, width: 1, color: '#f00' }] } }), hcBase({})] })
    add({ id: 'hc-marginleft-removed', kind: 'hc', point: 1, desc: 'A: chart.marginLeft:75 -> B: 省略marginLeft', steps: [hcBase({}), (function() { var o = hcBase({}); delete o.chart.marginLeft; return o })()] })
    add({ id: 'hc-type-bar-line', kind: 'hc', point: 1, desc: 'A: chart.type bar -> B: line', steps: [hcBase({ chart: { type: 'bar' } }), hcBase({ chart: { type: 'line' } })] })
    add({ id: 'hc-chain-3', kind: 'hc', point: 1, desc: '連續三次更新: A(min/max) -> B(max:3) -> C(無)', steps: [hcBase({ yAxis: { min: -200, max: 200 } }, 2.9), hcBase({ yAxis: { max: 3 } }, 2.9), hcBase({}, 2.9)] })
    add({ id: 'hc-data-only-len', kind: 'hc', point: 1, desc: '僅資料改變: 20點 -> 40點', steps: [hcBase({}, 100, 3), hcBase({ series: [{ data: D.genXY(40, 250, 7, 0, 1) }] })] })
    add({ id: 'hc-data-only-twice', kind: 'hc', point: 1, desc: '僅資料連續兩次改變(新建首算軸長不同於更新, 刻度間隔50對25)', steps: [hcBase({}, 100, 3), hcBase({}, 250, 7), hcBase({}, 60, 9)] })
    add({ id: 'hc-data-only-multi', kind: 'hc', point: 1, desc: '兩系列, 僅第2系列資料改變', steps: [hcBase({ series: [{ name: 'a', data: D.genXY(20, 100, 3, 0, 1) }, { name: 'b', data: D.genXY(20, 100, 4, 0, 1) }] }), hcBase({ series: [{ name: 'a', data: D.genXY(20, 100, 3, 0, 1) }, { name: 'b', data: D.genXY(20, 400, 8, 0, 1) }] })] })
    add({ id: 'hc-series-name-change', kind: 'hc', point: 1, desc: '只改系列名稱(新建首算軸長不同於更新, 刻度間隔100對50)', steps: [hcBase({ series: [{ name: 'a', data: D.genXY(20, 100, 3, 0, 1) }] }), hcBase({ series: [{ name: 'b', data: D.genXY(20, 100, 3, 0, 1) }] })] })
    add({ id: 'hc-linewidth-removed', kind: 'hc', point: 1, desc: 'A: yAxis.lineWidth:3,gridLineWidth:3 -> B: 省略(預設值非undefined之鍵)', steps: [hcBase({ yAxis: { lineWidth: 3, gridLineWidth: 3 } }), (function() { var o = hcBase({}); delete o.yAxis.gridLineWidth; return o })()] })
    add({ id: 'hc-height-change', kind: 'hc', point: 1, desc: 'A: chart.height:300 -> B: chart.height:200', steps: [hcBase({ chart: { height: 300 } }), hcBase({ chart: { height: 200 } })] })
    add({ id: 'hc-margin-change', kind: 'hc', point: 1, desc: 'A: marginTop:25 -> B: marginTop:120', steps: [hcBase({}), hcBase({ chart: { marginTop: 120 } })] })
    add({ id: 'hc-legend-toggle', kind: 'hc', point: 1, desc: 'A: legend啟用 -> B: legend關閉', steps: [noMargin(hcBase({ legend: { enabled: true }, title: { text: 'T' } })), noMargin(hcBase({ legend: { enabled: false }, title: { text: null } }))] })
    add({ id: 'hc-title-toggle-ymax', kind: 'hc', point: 1, desc: 'A: 有標題 -> B: 無標題, yAxis{max:500}', steps: [noMargin(hcBase({ title: { text: 'T' } })), noMargin(hcBase({ title: { text: null }, yAxis: { max: 500 } }))] })
    add({ id: 'hc-ymax3-bigdata', kind: 'hc', point: 1, desc: 'A: 資料±250無max -> B: yAxis{max:3}', steps: [hcBase({}, 250), hcBase({ yAxis: { max: 3 } }, 250)] })

    //---- Highstock ----
    add({ id: 'hs-data-only-len', kind: 'hs', point: 1, desc: 'Highstock僅資料改變: 200點 -> 400點', steps: [hsBase({}, 100, 5), hsBase({ series: [{ data: D.genXY(400, 250, 9, X0, DX) }] })] })
    add({ id: 'hs-data-only-twice', kind: 'hs', point: 1, desc: 'Highstock僅資料連續兩次改變', steps: [hsBase({}, 100, 5), hsBase({}, 250, 9), hsBase({}, 60, 13)] })
    add({ id: 'hs-data-only-startontick', kind: 'hs', point: 2, desc: 'Highstock xAxis{startOnTick:true,endOnTick:true}且僅資料連續改變', steps: [hsBase({ xAxis: { startOnTick: true, endOnTick: true } }, 100, 5), hsBase({ xAxis: { startOnTick: true, endOnTick: true } }, 250, 9), hsBase({ xAxis: { startOnTick: true, endOnTick: true } }, 60, 13)] })
    add({ id: 'hs-navigator-off-height', kind: 'hs', point: 1, desc: 'Highstock A: navigator+scrollbar(預設) -> B: 皆關閉, 資料±250', steps: [hsBase({}, 250), hsBase({ navigator: { enabled: false }, scrollbar: { enabled: false } }, 250)] })
    add({ id: 'hs-navigator-off-ymax', kind: 'hs', point: 1, desc: 'Highstock A: navigator預設 -> B: navigator關閉且yAxis{max:3}', steps: [hsBase({}, 2.9), hsBase({ navigator: { enabled: false }, scrollbar: { enabled: false }, yAxis: { max: 3 } }, 2.9)] })
    add({ id: 'hs-startontick-forced', kind: 'hs', point: 2, desc: 'A: xAxis{}(navigator預設啟用) -> B: xAxis{startOnTick:true}', steps: [hsBase({}), hsBase({ xAxis: { startOnTick: true } })] })
    add({ id: 'hs-startontick-same', kind: 'hs', point: 2, desc: 'A、B皆xAxis{startOnTick:true}, 僅資料不同', steps: [hsBase({ xAxis: { startOnTick: true } }, 250, 5), hsBase({ xAxis: { startOnTick: true } }, 250, 9)] })
    add({ id: 'hs-startontick-endontick', kind: 'hs', point: 2, desc: 'A、B皆xAxis{startOnTick:true,endOnTick:true}, 僅資料不同', steps: [hsBase({ xAxis: { startOnTick: true, endOnTick: true } }, 250, 5), hsBase({ xAxis: { startOnTick: true, endOnTick: true } }, 250, 9)] })
    add({ id: 'hs-navigator-off', kind: 'hs', point: 1, desc: 'A: navigator+scrollbar啟用 -> B: 皆關閉', steps: [hsBase({}), hsBase({ navigator: { enabled: false }, scrollbar: { enabled: false } })] })
    add({ id: 'hs-navigator-off-startontick', kind: 'hs', point: 2, desc: 'A: navigator啟用,xAxis{startOnTick:true} -> B: navigator關閉,xAxis{startOnTick:true}', steps: [hsBase({ xAxis: { startOnTick: true } }), hsBase({ xAxis: { startOnTick: true }, navigator: { enabled: false }, scrollbar: { enabled: false } })] })
    add({ id: 'hs-navigator-on', kind: 'hs', point: 1, desc: 'A: navigator關閉 -> B: 啟用(更新後導覽列不出現)', steps: [hsBase({ navigator: { enabled: false }, scrollbar: { enabled: false } }), hsBase({})] })
    add({ id: 'hs-data-only', kind: 'hs', point: 1, desc: '僅資料改變', steps: [hsBase({}, 100, 5), hsBase({}, 250, 9)] })
    add({
        id: 'hs-zoom-then-update', kind: 'hs', point: 1, desc: 'xAxis.setExtremes後更新資料(重建後縮放重置、與新建相同)', steps: [hsBase({}), hsBase({}, 250, 9)],
        prep: function(chart) { chart.xAxis[0].setExtremes(X0 + 20 * DX, X0 + 90 * DX, true) },
    })
    add({ id: 'hs-border-order', kind: 'hs', point: 3, desc: 'Highstock改gridLineColor一次後DOM順序', steps: [hsBase({}), hsBase({ xAxis: { gridLineColor: '#dddddd' }, yAxis: { gridLineColor: '#dddddd' } })] })
    add({ id: 'hs-set-max3', kind: 'hs', point: 1, desc: 'Highstock A: 無max(資料±2.9) -> B: yAxis{max:3}', steps: [hsBase({}, 2.9), hsBase({ yAxis: { max: 3 } }, 2.9)] })
    add({ id: 'hs-removed-minmax', kind: 'hs', point: 1, desc: 'Highstock A: yAxis{min:-200,max:200} -> B: yAxis{}', steps: [hsBase({ yAxis: { min: -200, max: 200 } }), hsBase({})] })

    w.HCT_SCEN = S
    w.HCT_hcBase = hcBase
    w.HCT_hsBase = hsBase

    //清除保留之兩圖
    w.HCT_cleanup = function() {
        var k = w.__keep
        if (k) {
            k.U.destroy()
            k.N.destroy()
            k.elU.remove()
            k.elN.remove()
            w.__keep = null
        }
    }

    //執行場景: 以元件建圖並依序改變options prop(U), 再以最後設定新建一張同尺寸圖(N), 保留兩圖供node端截圖比對(之後須呼叫HCT_cleanup)
    //opt.hasMode為true時才傳updateMode(值為opt.mode), 否則使用元件預設
    w.HCT_run = function(id, opt) {
        var sc = S.find(function(s) { return s.id === id })
        return w.HCT_runSteps(sc, opt)
    }

    //sc為{id, kind, steps, prep?, desc?, point?}, 場景定義見上; 亦供test/host/geo.js之w-geo-vue型設定使用
    w.HCT_runSteps = async function(sc, opt) {
        opt = opt || {}
        var id = sc.id
        var elU = D.mkDiv(sc.w, sc.h)
        var elN = D.mkDiv(sc.w, sc.h)
        var U = await D.make(sc.kind, sc.steps[0], elU, opt.mode, !!opt.hasMode)
        if (sc.prep) {
            sc.prep(U.chart)
            await D.sleep(30)
        }
        for (var i = 1; i < sc.steps.length; i++) {
            await U.update(sc.steps[i])
        }
        var N = await D.make(sc.kind, sc.steps[sc.steps.length - 1], elN, undefined, false)
        await D.sleep(60)
        var sU = D.snap(U.chart)
        var sN = D.snap(N.chart)
        var namesU = sU.order.names.join(' | ')
        var namesN = sN.order.names.join(' | ')
        delete sU.order.names
        delete sN.order.names
        var diffs = D.diff(sU, sN)
        if (namesU !== namesN) {
            diffs.push({ path: 'order.names', updated: namesU, fresh: namesN })
        }
        w.__keep = { U: U, N: N, elU: elU, elN: elN }
        return { id: id, kind: sc.kind, point: sc.point, desc: sc.desc, diffs: diffs, updated: sU, fresh: sN, keepIds: [elU.id, elN.id] }
    }

})(window)
