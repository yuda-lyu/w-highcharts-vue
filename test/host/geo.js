/* w-geo-vue型設定(使用端確認用): 重現w-geo-vue之WSptLiqPlotDepth(液化分析頁深度剖線圖)產生options之形狀與重算行為.
 * 形狀取自w-geo-vue(只讀參照, 未修改): src/components/WSptLiqPlotDepth.vue之genHc、addLineFs、genOpt與src/js/getDefChart.mjs、getDefAxis.mjs:
 * - 圖寬高固定(chart.width、height)、chart.inverted為true(深度為縱軸), 框線plotBorderColor為#666、格線gridLineColor為#eeeeee
 * - 參數名稱含'-FS'者(FS圖)添加FS=1之基準線並鎖定值軸範圍yAxis.min為0、max為3; 其他參數之圖不設max
 * - labels.formatter於每次computed重算皆產生新函數(內容相同但函數參照不同), 故每次重算options皆視為已變更
 * - WSptLiqPlotDepths.vue以索引為key(:key="'kst-'+kst")重用圖元件, 切換參數時同位置之圖元件被餵入不同參數之設定 */
(function(w) {
    var D = w.HCT

    //getDefAxis(w-geo-vue/src/js/getDefAxis.mjs)
    function getDefAxis(vDig) {
        return {
            crosshair: true,
            title: { useHTML: true, text: '', style: { fontFamily: 'sans-serif', fontSize: '12pt', color: '#000000' } },
            softMax: undefined,
            labels: {
                autoRotation: false,
                style: { fontFamily: 'sans-serif', fontSize: '9pt', color: '#222' },
                formatter: function() { return vDig ? Math.round(this.value * Math.pow(10, vDig)) / Math.pow(10, vDig) : this.value }, //每次呼叫皆為新函數
            },
            lineColor: '#666',
            lineWidth: 1,
            gridLineColor: '#eeeeee',
            gridLineWidth: 1,
            minorGridLineColor: '#eeeeee',
            minorGridLineWidth: 1,
            tickPosition: 'inside',
            tickColor: '#222222',
            tickWidth: 1,
            tickLength: 5,
            minorTickPosition: 'inside',
            minorTickColor: '#222222',
            minorTickWidth: 1,
            minorTickLength: 5,
        }
    }

    //genOpt(WSptLiqPlotDepth.vue之genOpt/genHc/addLineFs); st為{name, data([[深度, 值]...]), width, height, valueTitle, depthTitle, depthMin, depthMax, plotType}
    function genOpt(st) {
        var useLine = st.plotType !== 'marker'
        var useMarker = st.plotType !== 'line'
        var ds = [{ type: 'line', name: st.name, data: st.data, color: '#69f', lineWidth: useLine ? 1 : 0, marker: { enabled: useMarker } }]
        var width = st.width
        var marginLeft = 75
        var chart = {
            animation: false,
            plotBorderColor: '#666',
            plotBorderWidth: 1,
            marginLeft: marginLeft,
            marginRight: 5,
            marginTop: 25,
            marginBottom: 65,
            spacingLeft: 0,
            spacingRight: 0,
            spacingTop: 0,
            spacingBottom: 0,
        }
        var dax = getDefAxis(1)
        dax.title.text = st.depthTitle
        dax.min = st.depthMin
        dax.max = st.depthMax
        if (!st.depthTitle) {
            chart.marginLeft = 6
            width -= marginLeft - 6
            dax.labels.formatter = function() { return '' }
        }
        dax.opposite = false
        var day = getDefAxis()
        day.title.text = st.valueTitle
        day.min = 0
        day.opposite = false
        var opt = {
            title: { text: null },
            credits: { enabled: false },
            plotOptions: { series: { animation: false } },
            chart: Object.assign({}, chart, { inverted: true, width: width, height: st.height }),
            xAxis: dax,
            yAxis: day,
            legend: { enabled: true, backgroundColor: 'rgba(255,255,255,0.75)', borderColor: '#aaa', borderWidth: 1, layout: 'vertical', align: 'left', verticalAlign: 'bottom', floating: true },
            series: ds,
        }
        if (st.name.indexOf('-FS') >= 0 || st.name.indexOf('-cmpFS') >= 0) {
            opt.series.push({ type: 'line', name: 'FS=1', data: [[opt.xAxis.min, 1], [opt.xAxis.max, 1]], color: '#f26', lineWidth: 1, marker: { enabled: false }, dashStyle: 'LongDash' })
            opt.yAxis.min = 0
            opt.yAxis.max = 3
        }
        return opt
    }

    //確定性之深度剖線資料: 深度0~20m每1m一點, 值= 基準 + 振幅*序列
    function depthData(n, base, amp, seed) {
        var ys = D.genY(n, amp, seed)
        return ys.map(function(y, i) { return [i, Math.max(0, Math.round((base + Math.abs(y)) * 100) / 100)] })
    }

    function st(name, data, over) {
        return Object.assign({ name: name, data: data, width: 220, height: 420, valueTitle: name, depthTitle: '深度(m)', depthMin: 0, depthMax: 20, plotType: 'line+marker' }, over || {})
    }

    var FS = depthData(21, 0.2, 2.4, 3) //FS值落在0.2~2.6
    var QC = depthData(21, 5, 35, 7) //qc值最大約40
    var NVAL = depthData(21, 2, 28, 9)

    //場景: steps為各次重算之st; 每次重算皆重新genOpt(新函數)
    var sets = [
        { id: 'geo-fs-to-nonfs', desc: 'FS圖(yAxis.max為3)切換為其他參數(無max)', steps: [st('SPT-FS', FS), st('qc', QC)] },
        { id: 'geo-nonfs-to-fs', desc: '其他參數切換為FS圖(max為3)', steps: [st('qc', QC), st('SPT-FS', FS)] },
        { id: 'geo-chain', desc: 'FS圖→其他參數→FS圖→另一參數(切換參數連續四次)', steps: [st('SPT-FS', FS), st('qc', QC), st('SPT-FS', FS), st('N值', NVAL)] },
        { id: 'geo-size-slider', desc: '寬高滑桿(同一參數, 寬高連續改變, 每次重算皆產生新函數)', steps: [st('qc', QC), st('qc', QC, { width: 240, height: 440 }), st('qc', QC, { width: 260, height: 460 })] },
        { id: 'geo-fs-size-slider', desc: 'FS圖寬高滑桿', steps: [st('SPT-FS', FS), st('SPT-FS', FS, { width: 240 }), st('SPT-FS', FS, { width: 260, height: 400 })] },
        { id: 'geo-plot-type', desc: '繪圖型態line+marker→marker→line', steps: [st('qc', QC), st('qc', QC, { plotType: 'marker' }), st('qc', QC, { plotType: 'line' })] },
        { id: 'geo-hide-depth-title', desc: '隱藏深度軸標題(depthTitle為空字串, marginLeft縮為6)後恢復', steps: [st('qc', QC), st('qc', QC, { depthTitle: '' }), st('qc', QC)] },
        { id: 'geo-depth-range', desc: '深度範圍改變(土柱合併後depthMin/Max不同)', steps: [st('SPT-FS', FS), st('SPT-FS', FS, { depthMin: 4, depthMax: 16 })] },
    ]
    sets.forEach(function(s) {
        s.kind = 'hc'
        s.w = 300 //容器須容得下各步之固定寬高(chart.width、height)
        s.h = 480
        s.steps = s.steps.map(function(x) { return genOpt(x) }) //預先產生各步options, 元件收到時內容雖相同但函數參照各異
    })

    w.HCT_GEO = sets.map(function(s) { return { id: s.id, desc: s.desc } })
    w.HCT_geoRun = function(id, opt) {
        var s = sets.find(function(x) { return x.id === id })
        return w.HCT_runSteps(s, opt)
    }
    w.HCT_geoGenOpt = genOpt

})(window)
