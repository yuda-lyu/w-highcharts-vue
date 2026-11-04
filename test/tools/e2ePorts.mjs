//e2ePorts: e2e測試站port之單一定義與保留, e2e-setup.mjs與unit-e2ePortReserve.test.mjs皆自此匯入(規格: C:\opensrcOper\dspec\e2e埠與多套件同跑.md E1~E6)
//- 本專案每個流程(測試檔)各有一個行程內靜態站, 彼此獨立, 故每流程各自取獨立保留(applyEnv:false, w-package-tools-e2e README §2.12):
//  沒有占用時即基準埠(位移0), 與導入前相同; 被占用時自動換埠並印出實際埠, 絕不殺占用者(E4); 偵測與綁定之間被搶走(EADDRINUSE)則重選(E5)
//- 本專案無行程可下殺: 靜態站與 mocha 同行程, 無逐檔 runner, 無依埠/名稱/命令列下殺之站點(unit-e2ePortReserve 以掃描守護)
import { reserveE2ePorts } from './e2eLib.mjs'


//FLOW_PORTS, 流程代號與其靜態站基準port(≥8000、固定不隨機、與sgud/rule/rulebook.md之e2e映射一致)
let FLOW_PORTS = {
    'update-vs-fresh': 8301,
    'navigator': 8302,
    'rebuild-resource': 8303,
    'update-mode': 8304,
    'geo-like': 8305,
}


//OTHER_TEST_PORTS, 本專案其他測試寫死且實際監聽之port(須與流程位移後之實際埠錯開, 供reserveE2ePorts之avoid)
//實查(Grep "listen\(|createServer|127\.0\.0\.1:|localhost:" test/): 除e2e-setup.mjs之靜態站外, unit-*與all測試無任何監聽, 故為空; 日後新增寫死port之測試須列入(unit-e2ePortReserve PR-013守護)
let OTHER_TEST_PORTS = []


//reserveBasePort, 為一個基準port取獨立保留(applyEnv:false), 回傳reserveE2ePorts之保留物件, 以portOf(base)取實際port
//opt可覆寫reserveE2ePorts之選項(單元測試注入regDir等)
function reserveBasePort(base, opt = {}) {
    return reserveE2ePorts([base], { applyEnv: false, avoid: OTHER_TEST_PORTS, ...opt })
}


//listenWithReselect, 以保留之實際port呼叫listenFn(port)綁定; 遇EADDRINUSE呼叫reservation.reselect換下一個位移再試(次數與選定共用上限, 用盡即拋錯並寫明占用者), 其他錯誤原樣拋出
//回傳{ port, value }, port為最終實際port, value為listenFn之回傳值
async function listenWithReselect(reservation, base, listenFn) {
    while (true) {
        let port = reservation.portOf(base)
        try {
            let value = await listenFn(port)
            return { port, value }
        }
        catch (err) {
            if (!err || err.code !== 'EADDRINUSE') {
                throw err
            }
            reservation.reselect(`EADDRINUSE ${port}`)
        }
    }
}


export {
    FLOW_PORTS,
    OTHER_TEST_PORTS,
    reserveBasePort,
    listenWithReselect,
}
