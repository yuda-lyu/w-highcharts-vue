import isEqual from 'lodash-es/isEqual.js'
import isobj from 'wsemi/src/isobj.mjs'


/**
 * 判斷prop新舊值是否視為未變更，供watcher略過無實質變化之觸發
 *
 * 父組件於模板以物件字面值傳入prop時(例如:options="{ series: [...] }")，每次重繪皆產生新物件(參照不同)，故內容相同時視為未變更；
 * 新舊值為同一物件時，代表由deep watcher偵測到物件內部異動(例如push資料點)，視為已變更
 *
 * @param {*} nv 輸入新值
 * @param {*} ov 輸入舊值
 * @returns {Boolean} 回傳是否視為未變更布林值
 * @example
 *
 * console.log(isPropUnchanged({ title: { text: 'a' } }, { title: { text: 'a' } }))
 * // => true
 *
 * let o = { title: { text: 'a' } }
 * console.log(isPropUnchanged(o, o))
 * // => false
 *
 */
function isPropUnchanged(nv, ov) {

    //同一參照: 物件代表內部異動視為已變更, 原始值相同視為未變更
    if (nv === ov) {
        return !isobj(nv)
    }

    //不同參照之物件: 內容相同視為未變更
    if (isobj(nv) && isobj(ov)) {
        return isEqual(nv, ov)
    }

    return false
}


export default isPropUnchanged
