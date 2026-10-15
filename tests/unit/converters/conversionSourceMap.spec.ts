import { describe, expect, it } from 'vitest'
import { converterRegistry } from '../../../src/converters/converterRegistry'
import { parseMarkdown } from '../../../src/parser/parseMarkdown'
import { OUTPUT_FORMATS, type OutputFormat } from '../../../src/types/conversion'
import type { MarkdownDocument } from '../../../src/types/markdown'

const markdown = [
  '# 見出し', '', '本文', '', '- 親', '  - 子', '',
  '> 引用1', '>', '> 引用2', '',
  '```ts', '# 記号', '', '**そのまま**', '```', '',
  '| 項目 | 内容 |', '| --- | --- |', '| 日本語 | 値 |', '', '最後',
].join('\n')

const expectedOutputLines: Record<OutputFormat, number[]> = {
  slack: [1, 3, 5, 8, 12, 18, 24],
  'backlog-markdown': [1, 3, 5, 8, 12, 18, 22],
  'backlog-notation': [1, 3, 5, 8, 12, 18, 21],
  'plain-text': [1, 2, 3, 5, 8, 11, 12],
}

describe.each(OUTPUT_FORMATS)('%sの変換位置情報', (format) => {
  const converter = converterRegistry[format]

  it('通常の変換と同じ本文・警告を返し、原文と出力のブロック開始行を対応付ける', () => {
    const document = parseMarkdown(markdown)
    const result = converter.convert(document, { includeSourceMap: true })
    const baseline = converter.convert(document)

    expect(result).toEqual({
      ...baseline,
      sourceMap: [1, 3, 5, 8, 12, 18, 22].map((sourceLine, index) => ({
        sourceLine, outputLine: expectedOutputLines[format][index],
      })),
    })
    expect(baseline.sourceMap).toBeUndefined()
    expect(result.output.split('\n').at(-1)).toBe('最後')
  })

  it('空文書では空の対応表を返す', () => {
    expect(converter.convert(parseMarkdown(''), { includeSourceMap: true }))
      .toEqual({ output: '', warnings: [], sourceMap: [] })
  })

  it('位置のないブロックと空のブロックも既存の出力と区切りを維持する', () => {
    const document: MarkdownDocument = { blocks: [
      { type: 'paragraph', children: [] },
      { type: 'paragraph', children: [{ type: 'text', value: '位置なし' }] },
      { type: 'paragraph', location: { line: 9, column: 1 }, children: [{ type: 'text', value: '目印' }] },
    ] }
    const result = converter.convert(document, { includeSourceMap: true })
    expect(result.output).toBe(format === 'plain-text' ? '位置なし\n\n目印' : '\n\n位置なし\n\n目印')
    expect(result.sourceMap).toEqual([{ sourceLine: 9, outputLine: format === 'plain-text' ? 3 : 5 }])
    expect({ output: result.output, warnings: result.warnings }).toEqual(converter.convert(document))
  })

  it('不完全なMarkdownと空行にも原文の実際の開始行を使う', () => {
    const document = parseMarkdown('\n\n**未完了の日本語\n次の行\n\n[リンク](')
    const result = converter.convert(document, { includeSourceMap: true })
    expect(result.sourceMap).toEqual([
      { sourceLine: 3, outputLine: 1 },
      { sourceLine: 6, outputLine: format === 'backlog-notation' ? 3 : 4 },
    ])
    expect({ output: result.output, warnings: result.warnings }).toEqual(converter.convert(document))
  })
})
