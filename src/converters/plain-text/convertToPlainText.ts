import type {
  ConversionResult,
  ConversionWarning,
  Converter,
} from '../../types/conversion'
import type {
  BlockNode,
  InlineNode,
  ListItemNode,
  ListNode,
  MarkdownDocument,
  SourceLocation,
  TableNode,
} from '../../types/markdown'
import { addRawHtmlWarning } from '../rawHtmlWarning'

type RenderContext = {
  warnings: ConversionWarning[]
}

function addLossyWarning(
  context: RenderContext,
  message: string,
  location?: SourceLocation,
): void {
  context.warnings.push({
    code: 'lossy-conversion',
    message,
    ...(location ? { location } : {}),
  })
}

function renderInlineNode(node: InlineNode, context: RenderContext): string {
  switch (node.type) {
    case 'text':
      return node.value
    case 'strong':
    case 'emphasis':
    case 'delete':
      return renderInlineNodes(node.children, context)
    case 'inlineCode':
      return node.value
    case 'link':
      if (node.title !== null) {
        addLossyWarning(
          context,
          'プレーンテキストではリンクタイトルを保持できないため、省略しました。',
          node.location,
        )
      }
      return `${renderInlineNodes(node.children, context)}（${node.url}）`
    case 'lineBreak':
      return '\n'
    case 'rawHtmlInline':
      addRawHtmlWarning(context.warnings, node.location)
      return node.value
  }
}

function renderInlineNodes(nodes: InlineNode[], context: RenderContext): string {
  return nodes.map((node) => renderInlineNode(node, context)).join('')
}

function indentContinuationLines(value: string, indent: string): string {
  return value
    .split('\n')
    .map((line, index) => (index === 0 ? line : `${indent}${line}`))
    .join('\n')
}

function renderListItem(
  item: ListItemNode,
  list: ListNode,
  itemIndex: number,
  depth: number,
  context: RenderContext,
): string {
  const indent = '  '.repeat(depth)
  let marker: string

  if (item.checked !== null) {
    marker = item.checked ? '■ ' : '□ '
    addLossyWarning(
      context,
      'プレーンテキストでは操作可能なチェックボックスを表現できないため、状態を記号に変換しました。',
      item.location,
    )
  } else if (list.ordered) {
    marker = `${(list.start ?? 1) + itemIndex}. `
  } else {
    marker = '- '
  }

  const [firstChild, ...remainingChildren] = item.children
  const sections: string[] = []

  if (firstChild?.type === 'list') {
    sections.push(`${indent}${marker.trimEnd()}`)
    sections.push(renderList(firstChild, depth + 1, context))
  } else if (firstChild) {
    const continuationIndent = `${indent}  `
    sections.push(
      `${indent}${marker}${indentContinuationLines(renderBlock(firstChild, context), continuationIndent)}`,
    )
  } else {
    sections.push(`${indent}${marker.trimEnd()}`)
  }

  for (const child of remainingChildren) {
    if (child.type === 'list') {
      sections.push(renderList(child, depth + 1, context))
    } else {
      const childIndent = `${indent}  `
      sections.push(
        renderBlock(child, context)
          .split('\n')
          .map((line) => `${childIndent}${line}`)
          .join('\n'),
      )
    }
  }

  return sections.join(item.spread ? '\n\n' : '\n')
}

function renderList(list: ListNode, depth: number, context: RenderContext): string {
  const itemSeparator = list.spread ? '\n\n' : '\n'
  return list.items
    .map((item, index) => renderListItem(item, list, index, depth, context))
    .join(itemSeparator)
}

function renderQuote(blocks: BlockNode[], context: RenderContext): string {
  return renderBlocks(blocks, context)
    .split('\n')
    .map((line) => (line.length > 0 ? `引用：${line}` : ''))
    .join('\n')
}

function renderCodeBlock(
  block: Extract<BlockNode, { type: 'codeBlock' }>,
  context: RenderContext,
): string {
  if (block.language !== null || block.meta !== null) {
    addLossyWarning(
      context,
      'プレーンテキストではコードブロックの言語名またはメタ情報を保持できないため、省略しました。',
      block.location,
    )
  }

  return block.value
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n')
}

function renderTableRow(cells: TableNode['header']['cells'], context: RenderContext): string {
  return cells.map((cell) => renderInlineNodes(cell.children, context)).join('\t')
}

function renderTable(table: TableNode, context: RenderContext): string {
  if (table.align.some((alignment) => alignment !== null)) {
    addLossyWarning(
      context,
      'プレーンテキストではテーブルの列配置を保持できないため、省略しました。',
      table.location,
    )
  }

  return [
    renderTableRow(table.header.cells, context),
    ...table.rows.map((row) => renderTableRow(row.cells, context)),
  ].join('\n')
}

function renderBlock(block: BlockNode, context: RenderContext): string {
  switch (block.type) {
    case 'heading':
      addLossyWarning(
        context,
        'プレーンテキストでは見出しレベルを保持できないため、共通の括弧表現に変換しました。',
        block.location,
      )
      return `【${renderInlineNodes(block.children, context)}】`
    case 'paragraph':
      return renderInlineNodes(block.children, context)
    case 'list':
      return renderList(block, 0, context)
    case 'quote':
      return renderQuote(block.children, context)
    case 'codeBlock':
      return renderCodeBlock(block, context)
    case 'table':
      return renderTable(block, context)
    case 'thematicBreak':
      return '──────────'
    case 'rawHtmlBlock':
      addRawHtmlWarning(context.warnings, block.location)
      return block.value
  }
}

function renderBlocks(blocks: BlockNode[], context: RenderContext): string {
  return blocks.map((block) => renderBlock(block, context)).join('\n\n')
}

export function convertToPlainText(document: MarkdownDocument): ConversionResult {
  const context: RenderContext = { warnings: [] }

  return {
    output: renderBlocks(document.blocks, context),
    warnings: context.warnings,
  }
}

export const plainTextConverter: Converter = {
  format: 'plain-text',
  convert: convertToPlainText,
}
