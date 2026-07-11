import { describe, expect, it } from 'vitest'
import { parseMarkdownForPreview } from '../parser/parseMarkdown'
import { renderMarkdownPreview } from './renderMarkdownPreview'

describe('renderMarkdownPreview', () => {
  it('中間表現から主要Markdown要素をHTMLへ描画する', () => {
    const document = parseMarkdownForPreview(
      '# 見出し\n\n**太字**と*斜体*\n\n- item\n\n> quote\n\n`code`\n\n---',
    )
    const html = renderMarkdownPreview(document)

    expect(html).toContain('<h1>見出し</h1>')
    expect(html).toContain('<strong>太字</strong>と<em>斜体</em>')
    expect(html).toContain('<ul><li><p>item</p></li></ul>')
    expect(html).toContain('<blockquote><p>quote</p></blockquote>')
    expect(html).toContain('<code>code</code>')
    expect(html).toContain('<hr>')
  })

  it('テキストをエスケープし、生HTMLを描画しない', () => {
    const html = renderMarkdownPreview(
      parseMarkdownForPreview('before <script>alert(1)</script> after\n\n<div>unsafe</div>'),
    )

    expect(html).toBe('<p>before alert(1) after</p>')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<div>')
  })

  it('危険なURLをリンク属性へ出力せず、安全なURLだけを許可する', () => {
    const unsafe = renderMarkdownPreview(parseMarkdownForPreview('[危険](javascript:alert(1))'))
    const safe = renderMarkdownPreview(parseMarkdownForPreview('[安全](https://example.com?a=1&b=2)'))

    expect(unsafe).toBe('<p>危険</p>')
    expect(safe).toContain('href="https://example.com?a=1&amp;b=2"')
  })

  it('コード本文をHTMLとして解釈しない', () => {
    const html = renderMarkdownPreview(parseMarkdownForPreview('```html\n<img src=x>\n```'))

    expect(html).toContain('&lt;img src=x&gt;')
    expect(html).not.toContain('<img')
  })
})
