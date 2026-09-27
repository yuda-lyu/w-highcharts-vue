import cloneDeep from 'lodash-es/cloneDeep.js'


/**
 * 深層複製Highcharts設定物件並關閉其內建reflow
 *
 * 傳入Highcharts者須為複本, 避免Vue響應式物件與Highcharts內部共用參照; 函數(例如formatter、events)保留原參照
 * 容器尺寸同步改由組件以w-component-vue之v-domresize(wsemi domDetect)處理, 故關閉Highcharts內建reflow(其以ResizeObserver觸發並防抖100ms)
 *
 * @param {Object} [options={}] 輸入Highcharts設定物件，預設{}
 * @returns {Object} 回傳複製後之設定物件，其chart.reflow為false
 * @example
 *
 * let o = { chart: { type: 'line' } }
 * let r = cloneOptNoReflow(o)
 * console.log(r.chart)
 * // => { type: 'line', reflow: false }
 * console.log(o.chart)
 * // => { type: 'line' }
 *
 */
function cloneOptNoReflow(options = {}) {

    //r
    let r = cloneDeep(options || {})

    //chart
    r.chart = {
        ...(r.chart || {}),
        reflow: false,
    }

    return r
}


export default cloneOptNoReflow
