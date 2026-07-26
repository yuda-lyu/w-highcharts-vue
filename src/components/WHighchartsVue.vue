<template>
    <!-- ref=$self為供外部存取組件之用 -->
    <cmp-highcharts ref="$self" :options="options"></cmp-highcharts>
</template>

<script>
import { genComponent } from 'vue-highcharts'
import iniHighcharts from '../js/iniHighcharts.mjs'


//Highcharts, 直接引用highcharts不使用cdn
let Highcharts = iniHighcharts()

//cmpHighcharts, 由vue-highcharts產生Highcharts繪圖組件
let cmpHighcharts = genComponent('Highcharts', Highcharts)


/**
 * @vue-prop {Object} [options={}] 輸入highcharts設定物件，預設{}
 */
export default {
    components: {
        cmpHighcharts,
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
