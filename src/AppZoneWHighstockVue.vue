<template>
    <div class="bkh">


        <div class="head1"><span style="cursor:pointer;" title="open for copy link to view component" onclick="window.open('//yuda-lyu.github.io/w-highcharts-vue/examples/app.html?cmp='+this.innerText,'_blank')">w-highstock-vue</span></div>


        <div style="font-size:0.9rem; margin-bottom:10px;">
            <span style="margin-right:10px;">Links:</span>
            <a href="//www.highcharts.com/" target="_blank" rel="noreferrer noopener">highcharts</a>
            <span style="margin:0px 10px">|</span>
            <a href="//www.highcharts.com/stock/demo" target="_blank" rel="noreferrer noopener">highstock examples</a>
            <span style="margin:0px 10px">|</span>
            <a href="//github.com/weizhenye/vue-highcharts" target="_blank" rel="noreferrer noopener">vue-highcharts</a>
        </div>


        <div>


            <div class="bk">
                <demolink
                    :pkgname="'w-highcharts-vue'"
                    :kbname="'w-highstock-vue'"
                    :casename="'line'"
                ></demolink>

                <w-highstock-vue
                    style="width:620px;"
                    :options="WHighstockVue.options1"
                ></w-highstock-vue>

            </div>


            <div class="bk">
                <demolink
                    :pkgname="'w-highcharts-vue'"
                    :kbname="'w-highstock-vue'"
                    :casename="'area'"
                ></demolink>

                <w-highstock-vue
                    style="width:620px;"
                    :options="WHighstockVue.options2"
                ></w-highstock-vue>

            </div>


        </div>


    </div>
</template>

<script>
import demolink from 'w-component-vue/src/components/demolink.vue'
import WHighstockVue from './components/WHighstockVue.vue'


export default {
    components: {
        demolink,
        WHighstockVue,
    },
    props: {
    },
    data: function() {
        return {
            'WHighstockVue': {
                'options1': {
                    // rangeSelector: {
                    //     enabled: true,
                    //     selected: 1
                    // },
                    title: {
                        text: 'AAPL Stock Price'
                    },
                    xAxis: {
                        type: 'datetime'
                    },
                    yAxis: {
                        title: {
                            text: 'Price'
                        }
                    },
                    series: [{
                        name: 'AAPL',
                        data: window.dataAAPL,
                        tooltip: {
                            valueDecimals: 2
                        }
                    }]
                },
                'options2': {
                    chart: {
                        zoomType: 'x'
                    },
                    // rangeSelector: {
                    //     enabled: true,
                    //     selected: 3 //3季=1年
                    // },
                    title: {
                        text: 'USD to EUR exchange rate over time'
                    },
                    subtitle: {
                        text: 'Pinch the chart to zoom in'
                    },
                    xAxis: {
                        type: 'datetime'
                    },
                    yAxis: {
                        title: {
                            text: 'Exchange rate'
                        }
                    },
                    legend: {
                        enabled: false
                    },
                    plotOptions: {
                        area: {
                            color: 'rgba(200,200,255,1)',
                            fillColor: {
                                linearGradient: {
                                    x1: 0,
                                    y1: 0,
                                    x2: 0,
                                    y2: 1
                                },
                                stops: [
                                    [0, 'rgba(200,200,255,1)'],
                                    [1, 'rgba(200,200,255,0.1)']
                                ]
                            },
                            marker: {
                                radius: 2
                            },
                            lineWidth: 1,
                            states: {
                                hover: {
                                    lineWidth: 1
                                }
                            },
                            threshold: null
                        }
                    },
                    series: [{
                        type: 'area',
                        name: 'USD to EUR',
                        data: window.dataUSD2EUR,
                    }]
                },
            },
            'actions': [
            ],
        }
    },
}
</script>

<style scoped>
</style>
