<template>
    <!-- ref=$self為供外部存取組件之用 -->
    <cmp-highstock ref="$self" :options="options"></cmp-highstock>
</template>

<script>
import { genComponent } from 'vue-highcharts'
import iniHighcharts from '../js/iniHighcharts.mjs'


//Highcharts, 直接引用highcharts不使用cdn
let Highcharts = iniHighcharts()

//cmpHighstock, 由vue-highcharts產生Highstock繪圖組件
let cmpHighstock = genComponent('Highstock', Highcharts)


/**
 * @vue-prop {Object} [options={}] 輸入highstock設定物件，預設{}
 */
export default {
    components: {
        cmpHighstock,
    },
    props: {
        options: {
            type: Object,
            default: () => {},
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
