import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

// jsdomではフォント合成の描画を検証できないため、既存の外部Playwright環境を使用する。
const modulePath = process.env.PLAYWRIGHT_MODULE
assert.ok(modulePath, 'PLAYWRIGHT_MODULEにPlaywrightの絶対パスを指定してください')
const { chromium, firefox, webkit } = await import(pathToFileURL(modulePath).href)
const baseUrl = process.env.FOCUS_BASE_URL ?? 'http://127.0.0.1:5173'
const source = '**太字の文章 Bold Text**\n\n*斜体の文章 Italic Text*\n\n***太字と斜体 Bold Italic***'
const cases = [
  { selector: 'p:nth-child(1) strong', normal: { fontWeight: '400' } },
  { selector: 'p:nth-child(2) em', normal: { fontStyle: 'normal' } },
  { selector: 'p:nth-child(3)', normal: { fontWeight: '400', fontStyle: 'normal' } },
]

async function readNormalPreviewTypography(page) {
  return page.locator('#markdown-preview').evaluate((element) => {
    const style = getComputedStyle(element)
    return [style.fontFamily, style.fontSize, style.fontWeight, style.fontStyle, style.fontSynthesis]
  })
}

for (const [engine, browserType] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await browserType.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.goto(baseUrl)
    const input = page.locator('#markdown-input')
    await input.fill(source)
    await page.locator('#preview-view-tab').click()
    await page.locator('#markdown-preview strong').first().waitFor()
    const normalPreview = await readNormalPreviewTypography(page)
    await page.locator('.focus-mode-button').click()
    await input.press('Control+Enter')
    await page.evaluate(() => document.fonts.ready)
    assert.equal(await page.evaluate(() => document.fonts.check('18px "Noto Sans JP"')), true)
    assert.equal(await input.evaluate((element) => getComputedStyle(element).fontSynthesis), 'none')

    for (const theme of ['light', 'dark']) {
      await page.locator('.app').evaluate((element, value) => { element.dataset.theme = value }, theme)
      for (const { selector, normal } of cases) {
        const element = page.locator(`#focus-markdown-preview ${selector}`)
        const decorated = await element.screenshot()
        // 計算済みのfont-weight/styleだけでは字形の違いを保証できない。
        await element.evaluate((node, styles) => {
          for (const child of [node, ...node.querySelectorAll('*')]) Object.assign(child.style, styles)
        }, normal)
        const undecorated = await element.screenshot()
        await element.evaluate((node) => {
          for (const child of [node, ...node.querySelectorAll('*')]) child.removeAttribute('style')
        })
        assert.ok(!decorated.equals(undecorated), `${engine}/${theme}/${selector}: 装飾と通常の字形が同じ`)
      }
    }

    await page.locator('.app').evaluate((element) => { element.dataset.theme = 'light' })
    await page.locator('.focus-mode-exit-button').click()
    assert.equal(await input.inputValue(), source)
    assert.equal(await input.evaluate((element) => getComputedStyle(element).fontSynthesis), 'none')
    assert.deepEqual(await readNormalPreviewTypography(page), normalPreview, '通常プレビューの文字組みが変わった')
    console.log(`${engine} ${browser.version()}: 両テーマの太字・斜体・組み合わせと通常プレビューを確認`)
  } finally {
    await browser.close()
  }
}
