import rollupFiles from 'w-package-tools/src/rollupFiles.mjs'


let fdSrc = './src/components/'
let fdTar = './dist'


rollupFiles({
    fns: 'WHighchartsVueAll.vue',
    fdSrc,
    fdTar,
    format: 'umd',
    //nameDistType: 'kebabCase',
    hookNameDist: () => {
        return 'w-highcharts-vue' //因來源檔為WHighchartsVueAll.vue, 故強制指定輸出名稱為套件名稱
    },
    globals: {
        'vue': 'Vue',
    },
    external: [
        'vue',
    ],
})

