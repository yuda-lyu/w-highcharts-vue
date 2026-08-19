# w-highcharts-vue
A vue component for highcharts and highstock.

![language](https://img.shields.io/badge/language-JavaScript-orange.svg) 
[![language](https://img.shields.io/badge/vue-2.x-brightgreen.svg)](https://github.com/vuejs/vue) 
[![npm version](http://img.shields.io/npm/v/w-highcharts-vue.svg?style=flat)](https://npmjs.org/package/w-highcharts-vue) 
[![license](https://img.shields.io/npm/l/w-highcharts-vue.svg?style=flat)](https://npmjs.org/package/w-highcharts-vue) 
[![npm download](https://img.shields.io/npm/dt/w-highcharts-vue.svg)](https://npmjs.org/package/w-highcharts-vue) 
[![npm download](https://img.shields.io/npm/dm/w-highcharts-vue.svg)](https://npmjs.org/package/w-highcharts-vue)
[![jsdelivr download](https://img.shields.io/jsdelivr/npm/hm/w-highcharts-vue.svg)](https://www.jsdelivr.com/package/npm/w-highcharts-vue)

Highcharts and vue-highcharts are bundled in this package, no need to load them from cdn.

## Documentation
To view documentation or get support, visit [docs](https://yuda-lyu.github.io/w-highcharts-vue/global.html).

## Example
To view some examples for more understanding, visit examples:

> **all components:** [web](//yuda-lyu.github.io/w-highcharts-vue/examples/app.html) [[source code](https://github.com/yuda-lyu/w-highcharts-vue/blob/master/docs/examples/app.html)]

## Installation

### Using npm(ES6 module):
```alias
npm i w-highcharts-vue
```
Import all components:
```alias
//choose component
<w-highcharts-vue
    ...
></w-highcharts-vue>

//import
import WHighchartsVue from 'w-highcharts-vue'

//use
Vue.use(WHighchartsVue)
```
Import one component:
```alias
//choose component
<w-highcharts-vue
    ...
></w-highcharts-vue>

//import
import WHighchartsVue from 'w-highcharts-vue/src/components/WHighchartsVue.vue'

//component
Vue.component('w-highcharts-vue',WHighchartsVue)
//or
export default {
    components: {
        WHighchartsVue,
        //or
        'w-highcharts-vue': WHighchartsVue,
    },
    ...
}
```

### In a browser(UMD module):

Add script for vue.
```alias
<script src="https://cdn.jsdelivr.net/npm/vue@2.x/dist/vue.min.js"></script>
```

Add script for w-highcharts-vue.
```alias
<script src="https://cdn.jsdelivr.net/npm/w-highcharts-vue@1.0.9/dist/w-highcharts-vue.umd.js"></script>
```

Directly use:
```alias
//app and component
<div id="app">
    <w-highcharts-vue
        ...
    ></w-highcharts-vue>
</div>

//use
Vue.use(window['w-highcharts-vue'])

//new
new Vue({
    el: '#app',
    data: {
        ...
    }
})
```

## Components

| component | tag | description |
| --- | --- | --- |
| WHighchartsVue | `w-highcharts-vue` | Highcharts chart, use `options` for [highcharts settings](https://www.highcharts.com/demo) |
| WHighstockVue | `w-highstock-vue` | Highstock chart, use `options` for [highstock settings](https://www.highcharts.com/stock/demo) |

Use `$refs` for accessing the inner chart instance:
```alias
//template
<w-highcharts-vue
    ref="hc"
    :options="options"
></w-highcharts-vue>

//chart, an instance of Highcharts.Chart
let chart = this.$refs.hc.$refs.$self.chart
```
