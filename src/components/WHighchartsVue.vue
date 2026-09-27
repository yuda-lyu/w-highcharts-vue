<template>
    <!-- ref=$self為供外部存取組件之用 -->
    <cmp-highcharts ref="$self" :options="options"></cmp-highcharts>
</template>

<script>
import iniHighcharts from '../js/iniHighcharts.mjs'
import genComponent from '../js/genComponent.mjs'


//Highcharts, 直接引用highcharts不使用cdn
let Highcharts = iniHighcharts()

//cmpHighcharts, 產生Highcharts繪圖組件(取代vue-highcharts, 見genComponent說明)
let cmpHighcharts = genComponent('Highcharts', Highcharts)


/**
 * @vue-prop {Object} [options={}] 輸入highcharts設定物件，變更時以chart.update就地更新(保留圖例顯隱、縮放等使用者狀態)，內容相同之新物件(例如模板物件字面值於每次重繪產生者)不視為變更；容器尺寸改變時自動同步圖表尺寸(容器隱藏時不同步)，options.chart.reflow給false則不同步，options.chart.width、height有給者該維度固定，預設{}
 */
export default {
    components: {
        cmpHighcharts,
    },
    props: {
        options: {
            type: Object,
            default: () => ({}),
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
