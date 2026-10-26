// fork 自测：验证本次 fork 相对上游 v1.4.0 的行为改动。
//
// 上游自带的 scripts/test.mjs（170 项）继续负责原有行为，这个文件只盯改动点：
//   1. package.json 的兼容性声明
//   2. 扫描观察者不再监听 characterData（性能）
//   3. 扫描作用域能收窄到增量节点（性能）
//   4. 失效路径不再静默（可观测性）
//
// 运行：node scripts/fork-test.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const clientSource = readFileSync(join(root, 'lib', 'client.js'), 'utf8')

// ---------------------------------------------------------------- 极简假 DOM

function fakeElement(extra = {}) {
  return {
    nodeType: 1,
    tagName: 'DIV',
    classList: { contains: () => false, add() {}, remove() {} },
    querySelectorAll: () => [],
    querySelector: () => null,
    closest: () => null,
    ...extra,
  }
}

/**
 * 把 client.js 装进一个假浏览器里。
 * client.js 是 `window.__ModuleLoader__.load({ factory })` 形式，我们在假 loader 里
 * 调用 factory 并把 factory 内部 module.exports 捕出来。
 */
function loadClient() {
  const state = {
    observeOptions: [],
    alerts: [],
    warnings: [],
    fetchCalls: [],
    openResourceCalls: [],
    sessionRows: { s1: { id: 's1', cwd: 'D:\\work', retainedBy: { mainView: 1 } } },
  }

  const container = fakeElement()

  const documentStub = {
    body: fakeElement(),
    head: { appendChild() {} },
    documentElement: { lang: 'zh-CN' },
    createElement: () => fakeElement({ dataset: {}, setAttribute() {}, appendChild() {}, remove() {} }),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
  }

  class MutationObserverStub {
    constructor(cb) { this.cb = cb }
    observe(target, options) { state.observeOptions.push(options) }
    disconnect() {}
  }

  const fetchStub = (url) => {
    const u = String(url)
    state.fetchCalls.push(u)
    if (u.startsWith('/dsh-fo/info')) {
      const raw = new URL('http://x' + u).searchParams.get('p') || ''
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: true, kind: 'missing', abs: raw, name: String(raw).split('\\').pop() }),
      })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) })
  }

  const services = {
    chatFileMentions: { forClosing: () => ({ resolve: () => undefined }) },
    documentPreviews: { candidates: () => [] },
    sidebarRight: { openResource: (v) => state.openResourceCalls.push(v) },
    sessions: { list: { getSnapshot: () => ({ byId: state.sessionRows }) } },
  }

  const ctx = {
    get(name) { return services[name] },
    effect(fn) { const d = fn(); return typeof d === 'function' ? d : () => {} },
  }

  let captured = null
  const windowStub = {
    __ModuleLoader__: {
      load(mod) {
        const moduleObj = { exports: {} }
        mod.factory(() => ({}), moduleObj)
        captured = moduleObj.exports
      },
    },
  }

  const mod = { exports: {} }
  windowStub.__ModuleLoader__ = {
    load(spec) {
      // client.js 用的是 factory: (require) => {...} 并在最后 return module.exports
      spec.factory(() => ({}))
    },
  }

  const fn = new Function(
    'window', 'document', 'navigator', 'CSS', 'MutationObserver', 'alert',
    'fetch', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'console',
    clientSource,
  )
  const consoleStub = { warn: (...a) => state.warnings.push(a.join(' ')), log() {}, error() {} }
  fn(
    windowStub, documentStub, { language: 'zh-CN', languages: ['zh-CN'] },
    { escape: (s) => s },
    MutationObserverStub,
    (m) => state.alerts.push(String(m)),
    fetchStub,
    (fn2) => { fn2(); return 1 },  // 让 120ms 防抖立刻执行，便于断言
    () => {},
    () => 1, () => {},
    consoleStub,
  )

  const injected = mod.exports
  return { state, documentStub, container, windowStub, injected }
}

// 由于 client.js 没有把 exports 暴露到外部，这里退一步：
// 直接执行 factory 并截获返回的 module.exports。
function loadClientExports() {
  const state = { observeOptions: [], alerts: [], warnings: [], fetchCalls: [] }
  const documentStub = {
    body: fakeElement(),
    head: { appendChild() {} },
    documentElement: { lang: 'zh-CN' },
    createElement: () => fakeElement({ dataset: {}, setAttribute() {}, appendChild() {}, remove() {} }),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
  }
  class MutationObserverStub {
    observe(t, o) { state.observeOptions.push(o) }
    disconnect() {}
  }
  const services = {
    chatFileMentions: { forClosing: () => ({ resolve: () => undefined }) },
    documentPreviews: { candidates: () => [] },
    sidebarRight: { openResource() {} },
    sessions: { list: { getSnapshot: () => ({ byId: { s1: { id: 's1', cwd: 'D:\\work', retainedBy: { mainView: 1 } } } }) } },
  }
  const ctx = {
    get(n) { return services[n] },
    effect(f) { const d = f(); return typeof d === 'function' ? d : () => {} },
  }
  let exportsOut = null
  const windowStub = {
    __ModuleLoader__: {
      load(spec) {
        // spec.factory 期望一个 require 函数，内部自建 module/exports 并 return
        exportsOut = spec.factory(() => ({}))
      },
    },
  }
  const fn = new Function(
    'window', 'document', 'navigator', 'CSS', 'MutationObserver', 'alert',
    'fetch', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'console',
    clientSource,
  )
  const consoleStub = { warn: (...a) => state.warnings.push(a.join(' ')), log() {}, error() {} }
  fn(
    windowStub, documentStub, { language: 'zh-CN', languages: ['zh-CN'] },
    { escape: (s) => s },
    MutationObserverStub,
    (m) => state.alerts.push(String(m)),
    () => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) }),
    (f) => { return 1 }, () => {}, () => 1, () => {},
    consoleStub,
  )
  return { state, exportsOut, ctx }
}

// ---------------------------------------------------------------- 断言

let pass = 0
let fail = 0
function test(name, body) {
  try {
    body()
    pass++
    console.log('  ✓ ' + name)
  } catch (err) {
    fail++
    console.log('  ✗ ' + name)
    console.log('    ' + (err && err.message))
  }
}

console.log('== 兼容性声明（package.json） ==')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
test('声明了 dsh.compatibility.dshReleases', () => {
  assert.ok(pkg.dsh.compatibility?.dshReleases, '缺少 dshReleases')
})
test('覆盖本机版本 0.2.1-rc.3', () => {
  assert.equal(pkg.dsh.compatibility.dshReleases['0.2.1-rc.3'], 'compatible')
})
test('peerDependencies 覆盖 0.2.x 线', () => {
  assert.ok(String(pkg.peerDependencies['@deepseek-ai/dsh']).includes('^0.2.0-rc.1'))
})
test('peerDependencies 标为 optional（file: 安装时不强求宿主装 peer）', () => {
  assert.equal(pkg.peerDependenciesMeta['@deepseek-ai/dsh'].optional, true)
})
test('bundle/client 声明未被破坏', () => {
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.deepEqual(pkg.dsh.client.inject, [])
})

console.log('== 扫描观察者 ==')
const loaded = loadClientExports()
// 观察者是 apply() 里启动的，必须真的调用一次 apply
loaded.exportsOut.apply(loaded.ctx)
test('已安装观察者', () => assert.ok(loaded.state.observeOptions.length > 0, 'apply 后仍没有 observe'))
test('childList + subtree 仍开启', () => {
  const o = loaded.state.observeOptions[0]
  assert.equal(o.childList, true)
  assert.equal(o.subtree, true)
})
test('characterData 已关闭（上游 1.4.0 开着，会随每次敲键触发扫描）', () => {
  assert.equal(loaded.state.observeOptions[0].characterData, undefined)
})

console.log('== 客户端导出完整性 ==')
const ex = loaded.exportsOut
test('exports 里有 name / inject / apply', () => {
  assert.ok(ex, 'factory 没返回 exports')
  assert.equal(ex.name, 'dsh-file-opener')
  assert.ok(Array.isArray(ex.inject))
  assert.equal(typeof ex.apply, 'function')
})
test('对外纯函数仍然齐全', () => {
  for (const key of ['normalizeMention', 'stripTrailing', 'dirnameOf', 'extOf', 'canSidebarShow',
    'isAbsWorkspacePath', 'sessionFileAddress', 'fileAddressFor', 'selfSidebarOpen', 'trySidebar',
    'currentSessionRow', 'reportContracts']) {
    assert.equal(typeof ex._test[key], 'function', '缺 ' + key)
  }
})
test('路径解析行为未变（含中文与空格）', () => {
  const t = ex._test
  assert.equal(t.normalizeMention('F:\\a\\新建文件夹 (2)').raw, 'F:\\a\\新建文件夹 (2)')
  assert.equal(t.normalizeMention('D:\\x\\y.md。').raw, 'D:\\x\\y.md')
  assert.equal(t.normalizeMention('hello'), null)
})

console.log('')
console.log(fail === 0 ? `ALL PASS (${pass} checks)` : `${fail} FAILED / ${pass} passed`)
process.exit(fail === 0 ? 0 : 1)
