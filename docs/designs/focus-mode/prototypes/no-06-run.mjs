import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// リポジトリの依存を増やさず、既存のPlaywright環境を明示して利用する。
const modulePath = process.env.PLAYWRIGHT_MODULE
if (!modulePath) throw new Error('PLAYWRIGHT_MODULEにplaywrightまたはplaywright-coreの絶対パスを指定してください')
const { chromium, firefox, webkit } = await import(modulePath)
const base = process.env.FOCUS_BASE_URL ?? 'http://127.0.0.1:5173'
const output = resolve(process.env.FOCUS_PROBE_OUTPUT ?? '/tmp/md-focus-no6')
await mkdir(output, { recursive: true })
const reports = []
const samples = ['', '文'.repeat(100) + '\n',
  '日本語の句読点、「括弧」。\t連続  空白 😀 👩‍💻\n\nhttps://example.invalid/' + 'abcde12345'.repeat(20) + '\n',
  'function abcdefghijklmnop() { return 1; }\n| 日本語 | 表 |\n']

for (const [engine, type] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await type.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.goto(base)
    const input = page.locator('#markdown-input')
    await page.locator('.focus-mode-button').click()
    await page.evaluate(() => document.fonts.ready)
    assert.equal(await input.evaluate(el => getComputedStyle(el).fontSize), '18px')
    const report = { engine, version: browser.version(), precision: [], performance: [], padding: [], affinity: [] }
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const sample of samples) {
        await input.fill(sample)
        assert.equal(await page.locator('.app--focus-mode').count(), 1)
        const data = await page.evaluate(async () => {
          const { probeTypewriterMeasurement } = await import('./docs/designs/focus-mode/prototypes/no-06-measurement.js')
          const el = document.querySelector('#markdown-input')
          const before = [el, el.value, el.selectionStart, el.selectionEnd, el.scrollTop, document.activeElement]
          const offsets = [0]
          let offset = 0
          for (const character of el.value) { offset += character.length; offsets.push(offset) }
          const result = probeTypewriterMeasurement(el, offsets)
          const after = [document.querySelector('#markdown-input'), el.value, el.selectionStart, el.selectionEnd, el.scrollTop, document.activeElement]
          if (before.some((v, i) => v !== after[i])) throw new Error('計測が編集状態を変更した')
          return result
        })
        assert.equal(await input.inputValue(), sample)
        report.precision.push({ width, sourceLength: data.sourceLength, lineHeight: data.lineHeight,
          maxHeightDelta: Math.max(...data.measurements.map(m => Math.abs(m.heightDelta))),
          maxYDelta: Math.max(...data.measurements.map(m => Math.abs(m.yDelta ?? 0))),
          missingRange: data.measurements.filter(m => m.rangeTop === null).length,
          differences: data.measurements.filter(m => m.yDelta !== null && Math.abs(m.yDelta) > data.lineHeight / 4).slice(0, 4),
        })
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 })
    for (const length of [10000, 50000]) {
      await input.fill('日本語長文と English と改行\n'.repeat(length).slice(0, length))
      assert.equal(await input.evaluate(el => getComputedStyle(el).fontSize), '18px')
      const result = await page.evaluate(async () => {
        const { probeTypewriterMeasurement } = await import('./docs/designs/focus-mode/prototypes/no-06-measurement.js')
        const el = document.querySelector('#markdown-input')
        return probeTypewriterMeasurement(el, Array.from({ length: 20 }, () => el.value.length - 1))
      })
      const times = result.measurements.map(m => m.durationMs).sort((a, b) => a - b)
      report.performance.push({ length: result.sourceLength, minMs: times[0], medianMs: (times[9] + times[10]) / 2, maxMs: times.at(-1), times })
    }
    for (const sample of ['', '短い本文\n最終行', '長文の最終行を確認する本文。\n'.repeat(100), '長文\n'.repeat(100) + '末尾改行\n']) {
      await input.fill(sample)
      report.padding.push(await page.evaluate(async () => {
        const { probeTypewriterTailPadding } = await import('./docs/designs/focus-mode/prototypes/no-06-measurement.js')
        return probeTypewriterTailPadding(document.querySelector('#markdown-input'))
      }))
    }
    assert.equal(await page.locator('.app--focus-mode').count(), 1)
    await input.fill('文'.repeat(100))
    await page.addStyleTag({ content: '#markdown-input { caret-color: red; }' })
    const bounds = await input.evaluate(el => {
      const s = getComputedStyle(el), r = el.getBoundingClientRect()
      return { left: r.left + parseFloat(s.paddingLeft), right: r.left + el.clientWidth - parseFloat(s.paddingRight),
        y: r.top + parseFloat(s.paddingTop) + parseFloat(s.lineHeight) / 2, lineHeight: parseFloat(s.lineHeight) }
    })
    for (const [name, x, y] of [['end-of-first', bounds.right - 1, bounds.y], ['start-of-second', bounds.left + 1, bounds.y + bounds.lineHeight]]) {
      await page.mouse.click(x, y)
      report.affinity.push({ name, x, y, ...await input.evaluate(el => ({ start: el.selectionStart, end: el.selectionEnd, direction: el.selectionDirection, scrollTop: el.scrollTop })) })
      await page.screenshot({ path: resolve(output, `${engine}-${name}.png`), caret: 'initial' })
    }
    reports.push(report)
  } finally {
    await browser.close()
  }
}
await writeFile(resolve(output, 'results.json'), JSON.stringify(reports, null, 2) + '\n')
console.log(`試作結果を ${output} に保存しました。数値だけでなくキャレット画像も確認してください。`)
