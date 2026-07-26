<script>
import WHighchartsVue from './WHighchartsVue.vue'
import WHighstockVue from './WHighstockVue.vue'

let WHighchartsVueAll = {
    install: function(Vue) {
        Vue.component('w-highcharts-vue', WHighchartsVue)
        Vue.component('w-highstock-vue', WHighstockVue)
    }
}

export default WHighchartsVueAll
</script>

