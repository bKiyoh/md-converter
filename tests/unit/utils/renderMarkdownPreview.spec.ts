import { describe, expect, it } from 'vitest'
import { parseMarkdownForPreview } from '../../../src/parser/parseMarkdown'
import type { MarkdownDocument } from '../../../src/types/markdown'
import { renderMarkdownPreview } from '../../../src/utils/renderMarkdownPreview'

function renderLinkUrl(url: string): string {
  const document: MarkdownDocument = {
    blocks: [
      {
        type: 'paragraph',
        children: [
          {
            type: 'link',
            url,
            title: null,
            children: [{ type: 'text', value: 'リンク' }],
          },
        ],
      },
    ],
  }

  return renderMarkdownPreview(document)
}

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

  it.each([
    ['javascriptスキーム', 'javascript:alert(1)'],
    ['スキーム中のタブ', 'java\tscript:alert(1)'],
    ['スキーム中の改行', 'java\nscript:alert(1)'],
    ['スキーム中の復帰', 'java\rscript:alert(1)'],
    ['URL中のNUL', 'https://example.com/\0path'],
    ['URL中のDEL', 'https://example.com/\u007fpath'],
    ['大文字小文字が混在する危険なスキーム', 'JaVaScRiPt:alert(1)'],
  ])('%sをリンク属性へ出力しない', (_description, url) => {
    const html = renderLinkUrl(url)

    expect(html).toBe('<p>リンク</p>')
  })

  it.each([
    ['HTTPS', 'https://example.com?a=1&b=2', 'https://example.com?a=1&amp;b=2'],
    ['HTTP', 'HTTP://example.com', 'HTTP://example.com'],
    ['相対URL', '/docs/getting-started', '/docs/getting-started'],
    ['mailto', 'mailto:user@example.com', 'mailto:user@example.com'],
    ['tel', 'tel:+81-90-1234-5678', 'tel:+81-90-1234-5678'],
  ])('%sのURLを許可する', (_description, url, escapedUrl) => {
    const html = renderLinkUrl(url)

    expect(html).toContain(`href="${escapedUrl}"`)
  })

  it('コード本文をHTMLとして解釈しない', () => {
    const html = renderMarkdownPreview(parseMarkdownForPreview('```html\n<img src=x>\n```'))

    expect(html).toContain('&lt;img src=x&gt;')
    expect(html).not.toContain('<img')
  })
})
