//unit-e2ePortReserve: e2e測試站port自動換埠之單元測試(規格 C:\opensrcOper\dspec\e2e埠與多套件同跑.md E1~E6; 規則帳本 sgud/rule/rulebook.md R06)
//- 用真實監聽(node http/net)扮演占用者; 與環境無關: 測試用基準port自空閒區動態挑選, 期望位移一律由「實際綁定檢查」動態算出, 占不到(已被他人占用)視為已占用, 不用skip
//- 不碰真實流程port(8301~8305): 與同一次mocha --parallel中的e2e檔並行也不互相干擾
//- 「被測碼不殺占用者」以: 占用者仍在監聽、被測碼打到0次、占用者自己的127.0.0.1客戶端仍連到占用者(未被遮蔽)驗證
import fs from 'fs'
import net from 'net'
import http from 'http'
import path from 'path'
import assert from 'assert'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import { FLOW_PORTS, OTHER_TEST_PORTS, reserveBasePort, listenWithReselect } from './tools/e2ePorts.mjs'
import { createFlow } from './tools/e2e-setup.mjs'


let testDir = path.dirname(fileURLToPath(import.meta.url))
let projRoot = path.resolve(testDir, '..')
let fdUnit = path.join(testDir, '_tmp', 'unit-e2ePortReserve')
let PROBE_TOOL = path.join(projRoot, 'node_modules', 'w-package-tools-e2e', 'tools', 'portProbe.mjs')
let HOSTS = ['127.0.0.1', '0.0.0.0', '::', '::1']
let QUIET = () => {}


//bindOk, 試綁定: true為可綁(或該位址族不支援), false為被占用
let bindOk = (port, host) => new Promise((resolve) => {
    let s = net.createServer()
    s.once('error', (err) => resolve(err.code === 'EAFNOSUPPORT' || err.code === 'EADDRNOTAVAIL'))
    s.listen(port, host, () => s.close(() => resolve(true)))
})


//portFree, 四種位址皆可綁才算空閒(同w-package-tools-e2e之偵測)
let portFree = async (port) => {
    for (let h of HOSTS) {
        if (!(await bindOk(port, h))) {
            return false
        }
    }
    return true
}


//firstFreeOffset, 動態期望: 自位移0起每100試, 略過avoid, 回傳第一個空閒位移
let firstFreeOffset = async (base, avoid = []) => {
    for (let off = 0; off < 5000; off += 100) {
        if (avoid.includes(base + off)) {
            continue
        }
        if (await portFree(base + off)) {
            return off
        }
    }
    throw new Error(`找不到空閒位移: ${base}`)
}


//pickBase, 自空閒區挑測試用基準port(P、P+100、P+200皆空閒), 由固定起點依序找(不隨機); 範圍14011~28511, 避開作業系統臨時埠區(Linux 32768起、Windows 49152起)與本機常見之11xxx服務埠
let blockNo = 0
let pickBase = async () => {
    while (blockNo < 30) {
        let p = 14011 + 500 * (blockNo++)
        if ((await portFree(p)) && (await portFree(p + 100)) && (await portFree(p + 200))) {
            return p
        }
    }
    throw new Error('找不到空閒測試port')
}


//occupy, 起真實HTTP占用者; host未給為node預設雙棧; 占不到(held=false)代表該port已被他人占用, 視同已占用
let occupy = (port, host) => new Promise((resolve) => {
    let st = { port, host, held: false, hits: 0, probes: 0, code: '', server: null }
    st.server = http.createServer((req, res) => {
        if (req.headers['x-pr-probe']) {
            st.probes++
        }
        else {
            st.hits++
        }
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ occupier: true, port }))
    })
    st.server.once('error', (err) => {
        st.code = err.code
        resolve(st)
    })
    st.server.listen(port, host, () => {
        st.held = true
        resolve(st)
    })
})


//needOcc, 占用者必須建立得起來才有意義: 已被他人占用(EADDRINUSE)視為已占用, 照常以動態期望斷言; 本機不支援該位址族(如無IPv6)則明確略過(不靜默退化為「無占用者」); 其他錯誤直接失敗
let needOcc = (ctx, occ) => {
    if (occ.held || occ.code === 'EADDRINUSE') {
        return
    }
    if (['EAFNOSUPPORT', 'EADDRNOTAVAIL'].includes(occ.code)) {
        ctx.skip()
    }
    throw new Error(`占用者建立失敗: ${occ.code}`)
}


let freeOccupier = (st) => new Promise((resolve) => {
    if (!st.held) {
        resolve()
        return
    }
    st.held = false
    st.server.closeAllConnections()
    st.server.close(() => resolve())
})


//get, 每次新建連線(agent:false)取得回應, 失敗回null
let get = (host, port, p = '/', headers = {}) => new Promise((resolve) => {
    let req = http.get({ host, port, path: p, headers: { connection: 'close', ...headers }, agent: false, timeout: 3000 }, (res) => {
        let b = ''
        res.on('data', (d) => (b += d))
        res.on('end', () => resolve({ status: res.statusCode, body: b }))
    })
    req.on('error', () => resolve(null))
    req.on('timeout', () => {
        req.destroy()
        resolve(null)
    })
})


//getRetry, get失敗(逾時/連線被拒)時最多再試2次: 高負載下偶發逾時不當成「被遮蔽」; 被遮蔽時回應非null(測試站回404)不受影響
let getRetry = async (host, port, p = '/', headers = {}) => {
    let r = null
    for (let i = 0; i < 3 && !r; i++) {
        r = await get(host, port, p, headers)
    }
    return r
}


//isOccupierBody, 回應是否來自占用者
let isOccupierBody = (r) => !!r && r.body.includes('"occupier":true')


//listenOn, 於指定位址綁定一個net伺服器; 失敗時reject帶err.code
let listenOn = (port, host) => new Promise((resolve, reject) => {
    let s = net.createServer()
    s.once('error', reject)
    s.listen(port, host, () => resolve(s))
})


let closeNet = (s) => new Promise((resolve) => s.close(() => resolve()))


//mkReg, 建立本案專用之預約登錄目錄(與使用者家目錄之真實登錄隔離)
let mkReg = () => fs.mkdtempSync(path.join(fdUnit, 'reg-'))


//walk, 遞迴列出資料夾內檔案(略過_tmp、pics)
let walk = (fd) => {
    let out = []
    for (let name of fs.readdirSync(fd)) {
        if (name === '_tmp' || name === 'pics') {
            continue
        }
        let fp = path.join(fd, name)
        if (fs.statSync(fp).isDirectory()) {
            out.push(...walk(fp))
        }
        else {
            out.push(fp)
        }
    }
    return out
}


//scan, 掃描test/下除本檔外之原始碼, 回傳符合pattern之「檔:行」
let scan = (pattern, exts = ['.mjs', '.js', '.html']) => {
    let hits = []
    for (let fp of walk(testDir)) {
        if (!exts.includes(path.extname(fp)) || path.basename(fp) === 'unit-e2ePortReserve.test.mjs') {
            continue
        }
        fs.readFileSync(fp, 'utf8').split(/\r?\n/).forEach((line, i) => {
            if (pattern.test(line)) {
                hits.push(`${path.relative(projRoot, fp).replace(/\\/g, '/')}:${i + 1}`)
            }
        })
    }
    return hits
}


describe('unit-e2ePortReserve: e2e測試站port自動換埠(規格E1~E6)', function() {

    //本檔所有案例的期望位移皆自0起算(動態期望), 故暫時清除位移類環境變數(多開工具或手動指定時會使共用函式自該位移起選), 結束還原
    let savedEnv = {}

    before(function() {
        for (let k of ['E2E_PORT_OFFSET', 'E2E_PORT_HOLD']) {
            savedEnv[k] = process.env[k]
            delete process.env[k]
        }
        fs.mkdirSync(fdUnit, { recursive: true })
    })

    after(function() {
        for (let [k, v] of Object.entries(savedEnv)) {
            if (v === undefined) {
                delete process.env[k]
            }
            else {
                process.env[k] = v
            }
        }
        fs.rmSync(fdUnit, { recursive: true, force: true })
        try {
            fs.rmdirSync(path.join(testDir, '_tmp'))
        }
        catch (err) {}
    })

    describe('保留與位移(reserveBasePort)', function() {

        it('PR-001 基準埠無人占用時即基準埠(E1: 沒有占用時行為不變), 並印出實際埠(E6)', async function() {
            let P = await pickBase()
            let lines = []
            let off = await firstFreeOffset(P) //動態期望(P剛挑為空閒, 通常為0)
            let r = reserveBasePort(P, { regDir: mkReg(), log: (s) => lines.push(s) })
            try {
                assert.strictEqual(r.portOf(P), P + off)
                assert.strictEqual(r.source, 'auto')
                if (off === 0) {
                    assert.ok(lines.some((s) => s.includes(`[e2e-port] 埠 [${P}](基準埠)`)), lines.join('\n')) //E6
                }
            }
            finally {
                r.release()
            }
        })

        for (let [label, host] of [['node預設雙棧', undefined], ['127.0.0.1', '127.0.0.1'], ['0.0.0.0', '0.0.0.0'], ['::', '::'], ['::1', '::1']]) {
            it(`PR-002 基準埠被占用者(綁定${label})占住: 自動換埠並印出實際埠, 占用者仍在監聽、被測碼打到0次(E2,E4,E6)`, async function() {
                let P = await pickBase()
                let occ = await occupy(P, host)
                let lines = []
                let r = null
                try {
                    needOcc(this, occ)
                    let off = await firstFreeOffset(P) //占得到即位移>0; 他人已占(EADDRINUSE)則同樣由實際綁定動態算出
                    r = reserveBasePort(P, { regDir: mkReg(), log: (s) => lines.push(s) })
                    assert.strictEqual(r.portOf(P), P + off)
                    if (occ.held) {
                        assert.ok(r.portOf(P) !== P, `占用者在${P}, 不應沿用`)
                        assert.ok(lines.some((s) => s.includes(`→ 實際埠 [${P + off}]`)), lines.join('\n')) //E6
                    }
                    assert.strictEqual(occ.server.listening || !occ.held, true, '占用者仍須在監聽')
                    assert.strictEqual(occ.hits, 0, '被測碼不得打到占用者')
                    if (occ.held && host !== '::1') {
                        //占用者自己的127.0.0.1客戶端仍連到占用者(未被遮蔽)
                        assert.ok(isOccupierBody(await getRetry('127.0.0.1', P, '/', { 'x-pr-probe': '1' })), '占用者自己的客戶端被遮蔽')
                    }
                }
                finally {
                    if (r) {
                        r.release()
                    }
                    await freeOccupier(occ)
                }
            })
        }

        it('PR-003 保留不寫環境變數(applyEnv:false): E2E_PORT_OFFSET、E2E_PORT_HOLD 前後不變, 各流程保留彼此獨立', async function() {
            let P = await pickBase()
            let occ = await occupy(P, '0.0.0.0')
            let before = [process.env.E2E_PORT_OFFSET, process.env.E2E_PORT_HOLD]
            let a = null
            let b = null
            try {
                needOcc(this, occ)
                let Q = await pickBase()
                let offP = await firstFreeOffset(P)
                let offQ = await firstFreeOffset(Q)
                let regDir = mkReg()
                a = reserveBasePort(P, { regDir, log: QUIET })
                b = reserveBasePort(Q, { regDir, log: QUIET })
                assert.deepStrictEqual([process.env.E2E_PORT_OFFSET, process.env.E2E_PORT_HOLD], before)
                assert.strictEqual(a.portOf(P), P + offP)
                assert.strictEqual(b.portOf(Q), Q + offQ, '占用P不得使其他流程之Q位移')
            }
            finally {
                if (a) {
                    a.release()
                }
                if (b) {
                    b.release()
                }
                await freeOccupier(occ)
            }
        })

        it('PR-004 同一登錄目錄下兩個保留不會選到同一組(預約排他)', async function() {
            let P = await pickBase()
            let regDir = mkReg()
            let a = reserveBasePort(P, { regDir, log: QUIET })
            let b = reserveBasePort(P, { regDir, log: QUIET })
            try {
                assert.ok(a.portOf(P) !== b.portOf(P), `兩者皆選到${a.portOf(P)}`)
            }
            finally {
                a.release()
                b.release()
            }
        })

        it('PR-005 寫死的其他測試埠(avoid)落在其上之位移直接跳過', async function() {
            let P = await pickBase()
            let off = await firstFreeOffset(P, [P])
            let r = reserveBasePort(P, { regDir: mkReg(), log: QUIET, avoid: [P] })
            try {
                assert.strictEqual(r.portOf(P), P + off)
                assert.ok(r.portOf(P) !== P)
            }
            finally {
                r.release()
            }
        })

    })

    describe('綁定被搶走之重選(listenWithReselect, E5)', function() {

        it('PR-006 保留後、綁定前基準埠被他人占走: 重選下一個位移綁定成功, 占用者不動、被打到0次', async function() {
            let P = await pickBase()
            let r = reserveBasePort(P, { regDir: mkReg(), log: QUIET })
            let occ = null
            let bound = null
            try {
                assert.strictEqual(r.portOf(P), P, '前提: P剛挑為空閒, 保留應為基準埠')
                occ = await occupy(P, '127.0.0.1') //保留之後才被占走
                needOcc(this, occ)
                let calls = []
                let res = await listenWithReselect(r, P, async (port) => {
                    calls.push(port)
                    bound = await listenOn(port, '127.0.0.1')
                    return bound
                })
                assert.strictEqual(res.port, r.portOf(P))
                assert.strictEqual(calls[calls.length - 1], res.port)
                if (occ.held) {
                    assert.ok(calls.length >= 2 && res.port !== P, `應重選: calls=${calls.join(',')}`)
                }
                assert.strictEqual(occ.server.listening || !occ.held, true)
                assert.strictEqual(occ.hits, 0)
            }
            finally {
                if (bound && bound.listening) {
                    await closeNet(bound)
                }
                r.release()
                if (occ) {
                    await freeOccupier(occ)
                }
            }
        })

        it('PR-007 重選用盡(maxTries:2)即停止並拋錯寫明占用者, 不下殺任何占用者', async function() {
            let P = await pickBase()
            let r = reserveBasePort(P, { regDir: mkReg(), log: QUIET, maxTries: 2 })
            let occ0 = null
            let occ1 = null
            try {
                occ0 = await occupy(P, '127.0.0.1')
                occ1 = await occupy(P + 100, '127.0.0.1')
                needOcc(this, occ0)
                needOcc(this, occ1)
                let err = null
                try {
                    await listenWithReselect(r, P, (port) => listenOn(port, '127.0.0.1'))
                }
                catch (e) {
                    err = e
                }
                assert.ok(err, '應拋錯')
                if (occ0.held && occ1.held) {
                    assert.strictEqual(err.code, 'E2E_PORT_EXHAUSTED')
                    assert.ok(Array.isArray(err.blocked) && err.blocked.length > 0, '須列出占用者')
                    assert.ok(String(err.message).includes(String(P + 100)), err.message)
                }
                for (let occ of [occ0, occ1]) {
                    assert.strictEqual(occ.server.listening || !occ.held, true, '占用者仍須在監聽')
                    assert.strictEqual(occ.hits, 0)
                }
            }
            finally {
                r.release()
                for (let occ of [occ0, occ1]) {
                    if (occ) {
                        await freeOccupier(occ)
                    }
                }
            }
        })

        it('PR-008 非EADDRINUSE之錯誤原樣拋出, 不重選', async function() {
            let P = await pickBase()
            let r = reserveBasePort(P, { regDir: mkReg(), log: QUIET })
            try {
                let boom = Object.assign(new Error('boom'), { code: 'EACCES' })
                await assert.rejects(() => listenWithReselect(r, P, async () => {
                    throw boom
                }), (e) => e === boom)
                assert.strictEqual(r.portOf(P), P, '不得重選')
                let ok = await listenWithReselect(r, P, async (port) => `v${port}`)
                assert.deepStrictEqual(ok, { port: P, value: `v${P}` })
            }
            finally {
                r.release()
            }
        })

    })

    describe('createFlow接線(真實靜態站, 真實占用者)', function() {

        let fdDist = null
        before(function() {
            fdDist = path.join(fdUnit, 'dist')
            fs.mkdirSync(fdDist, { recursive: true })
            fs.writeFileSync(path.join(fdDist, 'w-highcharts-vue.umd.js'), 'stub-bundle')
        })

        for (let [label, host] of [['node預設雙棧', undefined], ['127.0.0.1', '127.0.0.1'], ['0.0.0.0', '0.0.0.0']]) {
            it(`PR-009 基準埠被占用者(綁定${label})占住: createFlow換埠啟動靜態站, origin由實際埠衍生, 占用者不被遮蔽與打到, teardown釋放保留(E2,E3,E4)`, async function() {
                let P = await pickBase()
                let occ = await occupy(P, host)
                let regDir = mkReg()
                let flow = createFlow('unit-pr', { port: P, fdDist, reserve: { regDir, log: QUIET } })
                try {
                    needOcc(this, occ)
                    let off = await firstFreeOffset(P)
                    await flow.setup()
                    assert.strictEqual(flow.origin, `http://127.0.0.1:${P + off}`)
                    if (occ.held) {
                        assert.ok(!flow.origin.endsWith(`:${P}`), '不得沿用被占用之基準埠')
                    }
                    let got = await getRetry('127.0.0.1', P + off, '/bundle/w-highcharts-vue.umd.js')
                    assert.ok(got && got.status === 200 && got.body === 'stub-bundle', JSON.stringify(got))
                    assert.strictEqual(occ.server.listening || !occ.held, true)
                    assert.strictEqual(occ.hits, 0)
                    if (occ.held) {
                        assert.ok(isOccupierBody(await getRetry('127.0.0.1', P, '/', { 'x-pr-probe': '1' })), '占用者自己的127.0.0.1客戶端被測試站遮蔽')
                    }
                    await flow.teardown()
                    assert.strictEqual(flow.origin, null)
                    assert.strictEqual(await get('127.0.0.1', P + off, '/'), null, '測試站應已關閉')
                    assert.deepStrictEqual(fs.readdirSync(regDir).filter((f) => f.endsWith('.json')), [], 'teardown須釋放預約')
                }
                finally {
                    await flow.teardown()
                    await freeOccupier(occ)
                }
            })
        }

        it('PR-010 createFlow於偵測後、綁定前被搶走: startServer保留EADDRINUSE, 重選下一位移, 占用者不動(E5)', async function() {
            assert.ok(fs.existsSync(PROBE_TOOL), `缺偵測工具: ${PROBE_TOOL}`)
            let realProbe = (ports) => {
                let r = spawnSync(process.execPath, [PROBE_TOOL, ...ports.map(String)], { encoding: 'utf8', windowsHide: true })
                if (r.error || r.status !== 0) {
                    throw new Error(`偵測工具執行失敗: ${r.error ? r.error.message : `exit ${r.status}`}`)
                }
                return JSON.parse(r.stdout)
            }
            let n = 0
            //第一次偵測回報全空閒(模擬偵測當下空閒、其後才被占走), 其後照實偵測
            let probe = (ports) => (n++ === 0 ? ports.map((port) => ({ port, free: true, host: '', code: '' })) : realProbe(ports))
            let P = await pickBase()
            let occ = await occupy(P, '127.0.0.1')
            let flow = createFlow('unit-pr', { port: P, fdDist, reserve: { regDir: mkReg(), log: QUIET, probe } })
            try {
                needOcc(this, occ)
                await flow.setup()
                let port = Number(flow.origin.split(':').pop())
                if (occ.held) {
                    assert.ok(port > P, `應重選: ${flow.origin}`)
                    assert.ok(n >= 2, `重選須再偵測一次: n=${n}`) //第一次為假的「空閒」, 第二次起為重選後之實際偵測
                }
                let got = await getRetry('127.0.0.1', port, '/bundle/w-highcharts-vue.umd.js')
                assert.ok(got && got.status === 200, JSON.stringify(got))
                assert.strictEqual(occ.server.listening || !occ.held, true)
                assert.strictEqual(occ.hits, 0)
            }
            finally {
                await flow.teardown()
                await freeOccupier(occ)
            }
        })

        it('PR-011 setup前呼叫openCase即拋錯(origin尚未確定)', async function() {
            let flow = createFlow('unit-pr', { port: 26011, fdDist, reserve: { regDir: mkReg(), log: QUIET } })
            await assert.rejects(() => flow.openCase({}), /尚未setup/)
        })

    })

    describe('靜態守護(掃描test/原始碼)', function() {

        it('PR-012 FLOW_PORTS: 5個流程、≥8000、互異, 與測試檔createFlow呼叫及帳本R06列出之port一致', function() {
            let names = Object.keys(FLOW_PORTS)
            assert.strictEqual(names.length, 5)
            let ports = Object.values(FLOW_PORTS)
            assert.ok(ports.every((p) => Number.isInteger(p) && p >= 8000))
            assert.strictEqual(new Set(ports).size, ports.length)
            //測試檔實際使用之流程代號
            let used = []
            for (let f of fs.readdirSync(testDir).filter((n) => n.startsWith('e2e-') && n.endsWith('.test.mjs'))) {
                for (let m of fs.readFileSync(path.join(testDir, f), 'utf8').matchAll(/createFlow\('([^']+)'/g)) {
                    used.push(m[1])
                }
            }
            assert.deepStrictEqual([...used].sort(), [...names].sort())
            //帳本映射
            let book = fs.readFileSync(path.join(projRoot, 'sgud', 'rule', 'rulebook.md'), 'utf8')
            let line = book.split(/\r?\n/).find((l) => l.startsWith('- port(固定'))
            assert.ok(line, '帳本缺port映射行')
            let inBook = {}
            for (let m of line.matchAll(/`([a-z-]+)`(\d{4,5})/g)) {
                inBook[m[1]] = Number(m[2])
            }
            assert.deepStrictEqual(inBook, FLOW_PORTS)
        })

        it('PR-013 OTHER_TEST_PORTS與實際寫死監聽一致: test/內除e2e-setup.mjs外無任何監聽(listen/createServer), 故avoid為空; 新增寫死port之測試須列入avoid', function() {
            let hits = scan(/\.listen\(|createServer\(/).filter((h) => !h.startsWith('test/tools/e2e-setup.mjs:'))
            assert.deepStrictEqual(hits, [], '有測試新增監聽, 請把其寫死port列入test/tools/e2ePorts.mjs之OTHER_TEST_PORTS並更新本案')
            assert.deepStrictEqual(OTHER_TEST_PORTS, [])
        })

        it('PR-014 test/無寫死之網址與埠(localhost:數字、127.0.0.1:數字; 網址一律由實際埠衍生, 規格§5第1項)', function() {
            assert.deepStrictEqual(scan(/(localhost|127\.0\.0\.1):\d{2,5}/), [])
        })

        it('PR-015 無依埠、名稱、命令列下殺之站點(規格§5第3項): test/無taskkill、process.kill、.kill(、Stop-Process、wmic、netstat、killPortListeners、killOwnListeners', function() {
            assert.deepStrictEqual(scan(/killPortListeners|killOwnListeners|taskkill|Stop-Process|process\.kill|\.kill\(|wmic|netstat/), [])
        })

        it('PR-016 e2e-setup接線: 自e2ePorts匯入、以reserveBasePort取保留、listenWithReselect綁定, 不再自訂FLOW_PORTS, server.listen僅一處', function() {
            let src = fs.readFileSync(path.join(testDir, 'tools', 'e2e-setup.mjs'), 'utf8')
            assert.ok(/from '\.\/e2ePorts\.mjs'/.test(src))
            assert.ok(/reserveBasePort\(base/.test(src))
            assert.ok(/listenWithReselect\(reservation, base/.test(src))
            assert.ok(!/let FLOW_PORTS\s*=/.test(src))
            assert.strictEqual((src.match(/\.listen\(/g) || []).length, 1)
            assert.strictEqual((src.match(/createServer\(/g) || []).length, 1)
            let ports = fs.readFileSync(path.join(testDir, 'tools', 'e2ePorts.mjs'), 'utf8')
            assert.ok(/applyEnv:\s*false/.test(ports))
        })

    })

})
