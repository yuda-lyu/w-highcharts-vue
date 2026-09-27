/**
 * 取得圖表容器可用尺寸，量測方式與Highcharts之Utilities.getStyle(寬高)相同，供v-domresize之getSize與圖表chartWidth、chartHeight比較
 *
 * 寬: offsetWidth與scrollWidth取小者，若boundingClientRect寬度介於其與其減1之間則取整(小數寬度)，再扣除左右padding
 * 高: offsetHeight與scrollHeight取小者，再扣除上下padding
 *
 * @param {HTMLElement} el 輸入容器元素
 * @returns {Object} 回傳物件{width,height}，單位px
 */
function getContainerSize(el) {

    //pint
    let pint = (v) => parseInt(v, 10) || 0

    //stl
    let stl = window.getComputedStyle(el)

    //width
    let w = Math.min(el.offsetWidth, el.scrollWidth)
    let bw = el.getBoundingClientRect ? el.getBoundingClientRect().width : w
    if (bw < w && bw >= w - 1) {
        w = Math.floor(bw)
    }
    let width = Math.max(0, w - pint(stl.paddingLeft) - pint(stl.paddingRight))

    //height
    let height = Math.max(0, Math.min(el.offsetHeight, el.scrollHeight) - pint(stl.paddingTop) - pint(stl.paddingBottom))

    return {
        width,
        height,
    }
}


export default getContainerSize
