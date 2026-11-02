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
<script src="https://yuda-lyu.github.io/w-highcharts-vue/dist/w-highcharts-vue.umd.js"></script>
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

## updateMode

Both components accept the prop `updateMode`, which decides how a change of `options` is applied. A new object with the same content (for example an object literal in a template, recreated on every render) is never treated as a change.

| updateMode | on `options` change | zoom / navigator range / hidden legend items | same settings always give the same chart |
| --- | --- | --- | --- |
| `'rebuild'` (default) | the chart is destroyed and created again | reset | yes |
| `'update'` | `chart.update(options, true, true)` in place | kept (point selection and tooltip hover are not kept) | **no**, see below |

Any other value (not a string, or an unknown string such as `'Update'`) is treated as not given and falls back to `'rebuild'`, without an error.

```alias
<w-highcharts-vue
    :options="options"
    updateMode="update"
></w-highcharts-vue>
```

Because `'rebuild'` creates a new `Highcharts.Chart` on every change, the instance in `chart` is replaced each time: always read it again instead of keeping a reference. Versions 1.0.23 to 1.0.29 used in-place update as the default; `'rebuild'` restores the behavior of 1.0.18 and earlier (Gitea #33).

### Why `chart.update` is not the default (known issues of Highcharts `chart.update`)

`chart.update` is a *merge*, not a *replacement*, and Highcharts itself does not guarantee that an updated chart equals a newly created one. The following was observed with Highcharts 11.4.8 in a real browser (line numbers refer to `node_modules/highcharts/highstock.src.js`; the core part is the same in `highcharts.src.js`). With `updateMode="update"` you accept all of them:

1. **Omitted keys keep their old values** (`Chart.update` merges into the user options, `:37593-37594`; `Axis.update` is `merge(this.userOptions, options)`, `:21392`, documented at `:21373-21374`). Only an explicit `undefined` can override (`:412-414`), and keys whose default is not `undefined` (for example `lineWidth`) cannot be restored that way. *Consequence:* options A has `yAxis.max: 3`, options B omits it, the axis still stops at 3. Highcharts maintainers answered in [issue #14969](https://github.com/highcharts/highcharts/issues/14969) that recreating the chart is the only way to get a non-merging update.
2. **Tick interval and range can differ from a new chart.** A new chart computes the first ticks with a reduced axis length (plot height minus the room reserved for x axis labels, `Chart.render`, `:36979-37054`); an update uses the final axis length (`Chart.redraw`, `:35779`, `:35848-35851`; `len` is kept by `Axis.keepProps`, `:21472-21481`). This is independent of the options: even changing only a series name or only the data can change the result. *Consequence:* the same options and size can give a y axis of `-200..200` with step 100 when created and `-150..150` with step 50 after an update. No option-level fix exists.
3. **`Axis.keepProps` keeps the user range** (`userMin`, `userMax`, `:21472-21481`), and `hardMin = pick(axis.userMin, options.min)` (`:19520`). *Consequence:* after the user zoomed, an explicit `xAxis.min` / `max` in the new options is overridden by the old zoom.
4. **Highstock: forced `startOnTick: false` / `endOnTick: false` are lost.** With the navigator enabled Highstock forces both to `false` (`getForcedAxisOptions`, `:53535-53551`), but only when the chart or an axis is created (`:53640`, `:53660`). If your options contain `startOnTick: true`, the first update (even a data-only one) sets it back to `true`. *Consequence:* dragging the navigator handles or zooming with the mouse wheel snaps the range to tick positions, so exact times cannot be selected.
5. **Highstock: switching the navigator / scrollbar leaves the layout wrong** (`Navigator.update`, `:49042-49053`, does not remove `chart.navigator` / `chart.scrollbar`; its `getMargins` listener, `:50097-50108`, always adds the 25px navigator margin). *Consequence:* after turning the navigator off the plot area stays 25px shorter (ticks change); a chart created without a navigator never shows one after it is turned on.
6. **The grid line groups end up above the plot border after every update** (`Axis.update` destroys and recreates them, `:21223-21230`, `:20722-20736`; equal `zIndex` 1 puts the new group after the existing elements, `:11056-11064`; the plot border is created with `zIndex: 1` in `drawChartBox`, `:36846-36853`). It happens on every `chart.update`, even a data-only one. *Consequence:* light grid lines cover the `plotBorderColor` frame, whose top and right edges turn light.

There are more differences of the same kind (`Series.update` rebuilds points under some conditions, changing the series type, `responsive.rules`); see `sgud/exp/experience.md` in the repository.

`'rebuild'` has none of these differences: the chart equals the one created directly from the same options. It is also not slower than updating in place (measured with 5 series x 2000 points: about 26 ms per change against 45 ms for Highcharts, 21 ms against 39 ms for Highstock).

### ResizeObserver

Highcharts creates one `ResizeObserver` per chart on load and never disconnects it, even when `chart.reflow` is `false`; its callback keeps the destroyed chart alive, so recreating charts in a loop accumulates them (30 rebuilds left 32 `Chart` objects alive). This component records the observer created while a chart is built and disconnects it before the next rebuild and when the component is destroyed (2 objects stay alive, independent of the number of rebuilds). The component sets `chart.reflow: false` itself and follows the container size with `v-domresize`, so the disconnected observer never did anything useful.
