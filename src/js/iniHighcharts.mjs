import Highcharts from 'highcharts'
import HighchartsMore from 'highcharts/highcharts-more.js'
import ModuleStock from 'highcharts/modules/stock.js'
import ModuleAnnotations from 'highcharts/modules/annotations.js'
import ModuleHeatmap from 'highcharts/modules/heatmap.js'
import ModuleBoost from 'highcharts/modules/boost.js'
import ModuleBoostCanvas from 'highcharts/modules/boost-canvas.js'
import iniMarkers from 'w-highcharts/src/iniMarkers.mjs'
import getDefOpt from 'w-highcharts/src/getDefOpt.mjs'


let inited = false


/**
 * 初始化Highcharts, 掛載各擴充模組, 並註冊w-highcharts之擴充標記與預設設定
 * 因WHighchartsVue與WHighstockVue皆須使用, 且共用同一Highcharts實體, 故僅首次呼叫時進行初始化
 *
 * @returns {Object} 回傳Highcharts全域物件
 */
function iniHighcharts() {

    //inited, 已初始化就直接回傳
    if (inited) {
        return Highcharts
    }
    inited = true

    //modules, highcharts@11各模組為工廠函數, 須傳入Highcharts才會掛載
    HighchartsMore(Highcharts)
    ModuleStock(Highcharts) //因vue-highcharts需有stock才能產生Highstock組件, 故WHighchartsVue亦須先載入stock
    ModuleAnnotations(Highcharts)
    ModuleHeatmap(Highcharts)
    ModuleBoost(Highcharts)
    ModuleBoostCanvas(Highcharts)

    //掛載至window, 因w-highcharts各函數是由getHighchart取用window.Highcharts, 不接受外部傳入 [w-highcharts/src/getHighchart.mjs:6-11]
    window['Highcharts'] = Highcharts

    //iniMarkers
    iniMarkers(Highcharts)

    //setOptions
    Highcharts.setOptions(getDefOpt())

    return Highcharts
}


export default iniHighcharts
