<template>
    <!-- ref=$self為供外部存取組件之用 -->
    <cmp-highstock ref="$self" :options="options" :updateMode="updateMode"></cmp-highstock>
</template>

<script>
import iniHighcharts from '../js/iniHighcharts.mjs'
import genComponent from '../js/genComponent.mjs'


//Highcharts, 直接引用highcharts不使用cdn
let Highcharts = iniHighcharts()

//cmpHighstock, 產生Highstock繪圖組件(取代vue-highcharts, 見genComponent說明)
let cmpHighstock = genComponent('Highstock', Highcharts)


/**
 * @vue-prop {Object} [options={}] 輸入highstock設定物件，變更時依updateMode更新(預設重建整張圖，同一份設定恆畫出同一張圖，縮放、導覽列範圍、圖例顯隱等互動狀態隨之重置)，內容相同之新物件(例如模板物件字面值於每次重繪產生者)不視為變更；容器尺寸改變時自動同步圖表尺寸(容器隱藏時不同步)，options.chart.reflow給false則不同步，options.chart.width、height有給者該維度固定，預設{}
 * @vue-prop {String} [updateMode='rebuild'] 輸入options變更時之更新方式，可為'rebuild'、'update'，非字串或未知字串視為未給而用預設，預設'rebuild'。
 * 'rebuild'：銷毀並重建整張圖，結果與以該設定直接新建者相同，不受先前設定與使用者操作影響，但縮放、導覽列範圍、圖例顯隱、點選取、tooltip等互動狀態重置，圖表實例(組件chart屬性)隨之更換，取用者須每次取最新。
 * 'update'：以chart.update就地更新(oneToOne)，保留縮放(含框選縮放)、導覽列範圍、圖例隱藏之系列，不保留點選取與tooltip懸停(tooltip殘留舊內容)；Highcharts之update與新建並不等價，'update'不保證等同重建，已知差異(Highcharts 11.4.8)如下，各附後果：
 * (1)update為合併而非取代，被省略之鍵沿用舊值：設定A給yAxis.max為3、設定B省略，更新後軸上限仍為3。
 * (2)刻度間隔可能與新建不同(新建首算刻度用縮減後之軸長，更新用最終軸長，此為Highcharts自身行為，與設定內容無關，連只改系列名稱或資料都會發生)：同設定同尺寸下y軸刻度間隔與範圍可能不同。
 * (3)Axis.keepProps殘留使用者範圍(userMin、userMax)且優先於新設定之min、max：使用者縮放過後，新設定給的軸範圍被舊縮放蓋過。
 * (4)Highstock開navigator時強制之startOnTick、endOnTick為false在更新後失效(設定帶startOnTick為true時第一次更新即失效)：拖導覽列把手與滾輪縮放被捨入至刻度，無法選取精確範圍。
 * (5)navigator、scrollbar開關切換後版面異常(關閉後仍殘留25px邊界使繪圖區變矮，無navigator建圖後開啟則不出現)：刻度改變或導覽列缺失。
 * (6)每次更新後格線群組排到圖框之後(兩者zIndex同為1)：淡色格線蓋住圖框，圖框上緣與右緣變淡。
 * 另Series.update、系列型別切換、responsive規則等亦各有update與新建不等價之處。成因與Highcharts原始碼位置見genComponent.mjs之說明與README之〈updateMode〉一節
 */
export default {
    components: {
        cmpHighstock,
    },
    props: {
        options: {
            type: Object,
            default: () => ({}),
        },
        //不宣告type: 非預期輸入視為未給, 由genComponent之getUpdateMode處置
        updateMode: {
            default: 'rebuild',
        },
    },
    data: function() {
        return {
        }
    },
    mounted: function() {
    },
    computed: {
    },
    methods: {
    },
}
</script>

<style scoped>
</style>
