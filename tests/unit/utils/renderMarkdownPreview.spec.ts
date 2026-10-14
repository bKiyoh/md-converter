import { describe, expect, it } from 'vitest'
import { parseMarkdownForPreview } from '../../../src/parser/parseMarkdown'
import type { MarkdownDocument } from '../../../src/types/markdown'
import { renderMarkdownPreview } from '../../../src/utils/renderMarkdownPreview'

function createPreview(markdown: string): HTMLDivElement {
  const preview = document.createElement('div')
  preview.innerHTML = renderMarkdownPreview(parseMarkdownForPreview(markdown))
  return preview
}

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
    const preview = createPreview(
      '# 見出し\n\n**太字**と*斜体*\n\n- item\n\n> quote\n\n`code`\n\n---',
    )

    expect(preview.querySelector('h1')?.textContent).toBe('見出し')
    expect(preview.querySelector('strong')?.textContent).toBe('太字')
    expect(preview.querySelector('em')?.textContent).toBe('斜体')
    expect(preview.querySelector('ul > li > p')?.textContent).toBe('item')
    expect(preview.querySelector('blockquote > p')?.textContent).toBe('quote')
    expect(preview.querySelector('code')?.textContent).toBe('code')
    expect(preview.querySelector('hr')).not.toBeNull()
  })

  it('テキストをエスケープし、生HTMLを描画しない', () => {
    const preview = createPreview(
      'before <script>alert(1)</script> after\n\n<div data-source-line="999">unsafe</div>',
    )

    expect(preview.children).toHaveLength(1)
    expect(preview.querySelector('p')?.textContent).toBe('before alert(1) after')
    expect(preview.querySelector('script, div, [data-source-line="999"]')).toBeNull()
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

  it('画像を読み込まず代替テキストとURLを表示する', () => {
    const preview = createPreview(
      '本文\n\n![説明](https://example.com/image.png)\n\n続き',
    )

    expect(preview.querySelectorAll('p')[1]?.textContent).toBe('画像: 説明 (https://example.com/image.png)')
    expect(preview.querySelector('img')).toBeNull()
  })

  it('主要ブロック・ネストしたリスト・日本語の表の行を原文の開始行へ対応付ける', () => {
    const preview = createPreview([
      '# 見出し',
      '',
      '段落 **太字**',
      '',
      '- 親',
      '  - 子',
      '',
      '3. 番号',
      '',
      '- [x] 完了',
      '',
      '> 引用',
      '> 続き',
      '',
      '```ts',
      'const value = "<tag>"',
      '```',
      '',
      '| 名前 | 説明 |',
      '| --- | --- |',
      '| 日本語 | 折り返し |',
      '| 二行目 | 内容 |',
      '',
      '---',
    ].join('\n'))

    expect(preview.querySelector('h1')?.getAttribute('data-source-line')).toBe('1')
    expect(preview.querySelector(':scope > p')?.getAttribute('data-source-line')).toBe('3')
    expect(preview.querySelector('ul')?.getAttribute('data-source-line')).toBe('5')
    expect(preview.querySelector('ul > li')?.getAttribute('data-source-line')).toBe('5')
    expect(preview.querySelector('ul ul')?.getAttribute('data-source-line')).toBe('6')
    expect(preview.querySelector('ul ul > li > p')?.getAttribute('data-source-line')).toBe('6')
    expect(preview.querySelector('ol')?.getAttribute('data-source-line')).toBe('8')
    expect(preview.querySelector('ol')?.getAttribute('start')).toBe('3')
    expect(preview.querySelector('input[checked]')?.closest('li')?.getAttribute('data-source-line')).toBe('10')
    expect(preview.querySelector('blockquote')?.getAttribute('data-source-line')).toBe('12')
    expect(preview.querySelector('blockquote > p')?.getAttribute('data-source-line')).toBe('12')
    expect(preview.querySelector('pre')?.getAttribute('data-source-line')).toBe('15')
    expect(preview.querySelector('pre > code')?.textContent).toBe('const value = "<tag>"')
    expect(preview.querySelector('table')?.getAttribute('data-source-line')).toBe('19')
    expect(Array.from(preview.querySelectorAll('tr'), (row) => row.getAttribute('data-source-line')))
      .toEqual(['19', '21', '22'])
    expect(preview.querySelector('tbody td')?.textContent).toBe('日本語')
    expect(preview.querySelector('hr')?.getAttribute('data-source-line')).toBe('24')
    expect(preview.querySelector('strong[data-source-line], code[data-source-line]')).toBeNull()
  })

  it('位置情報のない中間表現も描画できる', () => {
    const document: MarkdownDocument = {
      blocks: [{ type: 'paragraph', children: [{ type: 'text', value: '本文' }] }],
    }

    expect(renderMarkdownPreview(document)).toBe('<p>本文</p>')
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    '不正な原文行 %s を属性へ出力しない',
    (line) => {
      const document: MarkdownDocument = {
        blocks: [{
          type: 'paragraph',
          children: [{ type: 'text', value: '本文' }],
          location: { line, column: 1 },
        }],
      }

      expect(renderMarkdownPreview(document)).toBe('<p>本文</p>')
    },
  )

  it('位置情報へ実行時に不正な文字列が渡ってもHTML属性へ混入させない', () => {
    const document: MarkdownDocument = {
      blocks: [{
        type: 'paragraph',
        children: [{ type: 'text', value: '本文' }],
        location: { line: '1" onclick="alert(1)' as unknown as number, column: 1 },
      }],
    }

    expect(renderMarkdownPreview(document)).toBe('<p>本文</p>')
  })
})
