/**
 * 執行fn期間收集其中建立之ResizeObserver實例，內部使用
 *
 * Highcharts(11.4.8)每建一圖，onload時由Chart.setReflow無條件以全域ResizeObserver建立一個監聽容器之偵測器，且無任何解除機制(highstock.src.js:36551-36559、呼叫處:37262)，
 * 不論chart.reflow是否為false(本套件恆給false，該偵測器之回呼因此什麼都不做，純屬累積)；
 * 其回呼閉包持有該圖物件，故反覆重建時，已destroy之圖殼物件(Chart)隨次數累積無法回收(實測重建30次後存活Chart物件32個，捕捉並disconnect後為2個)；
 * 本函數於fn期間暫以包裝建構函數取代window.ResizeObserver記下所建立之實例，結束(含拋錯)即還原，呼叫端於圖表銷毀時對所收集之實例disconnect；
 * 無ResizeObserver(例如伺服器端或舊瀏覽器)時直接執行fn，Highcharts改以window resize事件並於destroy時解除，無需處理
 *
 * @param {Function} fn 輸入同步執行之函數(例如建立Highcharts圖表)
 * @param {Array} list 輸入收集用陣列，建立之ResizeObserver實例會被push進去
 * @returns {*} 回傳fn之回傳值
 */
function trackResizeObserver(fn, list) {

    //無window或無ResizeObserver
    if (typeof window === 'undefined' || typeof window.ResizeObserver !== 'function') {
        return fn()
    }

    //以包裝建構函數取代, 回傳原生實例(建構函數回傳物件時new得到該物件), 共用prototype故instanceof等行為不變
    let Orig = window.ResizeObserver
    let Tracked = function(callback) {
        let ro = new Orig(callback)
        list.push(ro)
        return ro
    }
    Tracked.prototype = Orig.prototype

    window.ResizeObserver = Tracked
    try {
        return fn()
    }
    finally {
        window.ResizeObserver = Orig
    }

}


export default trackResizeObserver
