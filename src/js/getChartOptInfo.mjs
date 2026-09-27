import get from 'lodash-es/get.js'
import isstr from 'wsemi/src/isstr.mjs'


/**
 * 由Highcharts設定物件取得尺寸同步所需資訊
 *
 * reflow: options.chart.reflow給false時為false(使用者不要隨容器同步尺寸)，否則為true
 * fixedWidth/fixedHeight: options.chart.width/height有給(非null、非undefined)時為true，Highcharts此時不使用容器該維度之尺寸
 * heightByWidth: options.chart.height為百分比字串(例如'60%')時為true，高度隨寬度變化
 *
 * @param {Object} [options={}] 輸入Highcharts設定物件，預設{}
 * @returns {Object} 回傳物件{reflow,fixedWidth,fixedHeight,heightByWidth}
 * @example
 *
 * console.log(getChartOptInfo({ chart: { height: '60%' } }))
 * // => { reflow: true, fixedWidth: false, fixedHeight: true, heightByWidth: true }
 *
 */
function getChartOptInfo(options = {}) {

    //reflow
    let reflow = get(options, 'chart.reflow', true) !== false

    //width, height
    let width = get(options, 'chart.width', null)
    let height = get(options, 'chart.height', null)

    //fixedWidth, fixedHeight
    let fixedWidth = width !== null && width !== undefined
    let fixedHeight = height !== null && height !== undefined

    //heightByWidth
    let heightByWidth = isstr(height) && height.trim().endsWith('%')

    return {
        reflow,
        fixedWidth,
        fixedHeight,
        heightByWidth,
    }
}


export default getChartOptInfo
