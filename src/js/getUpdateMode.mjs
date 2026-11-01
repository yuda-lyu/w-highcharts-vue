/**
 * 正規化updateMode(options變更時之更新方式)，內部使用
 *
 * 'rebuild'(預設)為options變更即重建整張圖，同一份設定恆畫出同一張圖；'update'為以chart.update就地更新，保留縮放、導覽列範圍、圖例顯隱，但不保證等同重建(已知差異見genComponent說明)；
 * 非字串或未知字串(含大小寫不同、前後空白)皆視為未給，改用預設'rebuild'，不報錯
 *
 * @param {*} v 輸入updateMode，可為'rebuild'、'update'，其他值視為未給
 * @returns {String} 回傳'rebuild'或'update'
 */
function getUpdateMode(v) {
    if (v === 'update') {
        return 'update'
    }
    return 'rebuild'
}


export default getUpdateMode
