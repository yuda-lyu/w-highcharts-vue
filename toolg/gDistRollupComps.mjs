import rollupFiles from 'w-package-tools/src/rollupFiles.mjs'


let fdSrc = './src/components/'
let fdTar = './dist'


rollupFiles({
    fns: 'WHighchartsVueAll.vue',
    fdSrc,
    fdTar,
    hookNameDist: () => {
        return 'w-highcharts-vue' //因來源檔為WHighchartsVueAll.vue, 故強制指定輸出名稱為套件名稱
    },
    globals: {
        'vue': 'Vue', //統一使用window內Vue, 故此處不打包進來, 若vue-cli則自動將Vue關聯至window內的Vue
    },
    external: [
        'vue',
    ],
})

