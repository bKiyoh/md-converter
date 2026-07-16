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

type InlineRenderOptions = {
  stripDecoration?: boolean
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

function renderInlineNode(
  node: InlineNode,
  context: RenderContext,
  options: InlineRenderOptions,
): string {
  switch (node.type) {
    case 'text':
      return node.value
    case 'strong':
      if (options.stripDecoration) {
        return renderInlineNodes(node.children, context, options)
      }
      return `「${renderInlineNodes(node.children, context, options)}」`
    case 'emphasis':
    case 'delete':
      return renderInlineNodes(node.children, context, options)
    case 'inlineCode':
      return `\`${node.value}\``
    case 'link':
      if (node.title !== null) {
        addLossyWarning(
          context,
          'プレーンテキストではリンクタイトルを保持できないため、省略しました。',
          node.location,
        )
      }
      return `${renderInlineNodes(node.children, context, options)}（${node.url}）`
    case 'lineBreak':
      return '\n'
    case 'rawHtmlInline':
      addRawHtmlWarning(context.warnings, node.location)
      return node.value
  }
}

function renderInlineNodes(
  nodes: InlineNode[],
  context: RenderContext,
  options: InlineRenderOptions = {},
): string {
  return nodes.map((node) => renderInlineNode(node, context, options)).join('')
}

function renderParagraph(
  block: Extract<BlockNode, { type: 'paragraph' }>,
  context: RenderContext,
): string {
  if (block.children.length === 1 && block.children[0]?.type === 'strong') {
    return `【${renderInlineNodes(block.children[0].children, context)}】`
  }

  return renderInlineNodes(block.children, context)
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
    .map((line) => (line.length > 0 ? `> ${line}` : '>'))
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

function containsDecoration(nodes: InlineNode[]): boolean {
  return nodes.some((node) => {
    switch (node.type) {
      case 'strong':
      case 'emphasis':
      case 'delete':
        return true
      case 'link':
        return containsDecoration(node.children)
      default:
        return false
    }
  })
}

function renderTableCells(
  cells: TableNode['header']['cells'],
  context: RenderContext,
): string[] {
  return cells.map((cell) =>
    renderInlineNodes(cell.children, context, { stripDecoration: true }),
  )
}

function tableContainsDecoration(table: TableNode): boolean {
  return [table.header, ...table.rows].some((row) =>
    row.cells.some((cell) => containsDecoration(cell.children)),
  )
}

function renderTable(table: TableNode, context: RenderContext): string {
  if (
    table.align.some((alignment) => alignment !== null) ||
    tableContainsDecoration(table)
  ) {
    addLossyWarning(
      context,
      'プレーンテキストではテーブルの列配置またはセル内装飾を保持できないため、省略しました。',
      table.location,
    )
  }

  if (table.header.cells.length === 2 && table.rows.length > 0) {
    return table.rows
      .map((row) => {
        const [label = '', value = ''] = renderTableCells(row.cells, context)
        return `${label}：${value}`
      })
      .join('\n')
  }

  return [table.header, ...table.rows]
    .map((row) => renderTableCells(row.cells, context).join('\t'))
    .join('\n')
}

function renderBlock(block: BlockNode, context: RenderContext): string {
  switch (block.type) {
    case 'heading':
      if (block.depth >= 4) {
        addLossyWarning(
          context,
          'プレーンテキストではレベル4以降の見出し階層を保持できないため、共通の小見出し表現に統合しました。',
          block.location,
        )
      }
      if (block.depth === 1) {
        return `【${renderInlineNodes(block.children, context)}】`
      }
      if (block.depth === 2) {
        return `■ ${renderInlineNodes(block.children, context)}`
      }
      if (block.depth === 3) {
        return `▼ ${renderInlineNodes(block.children, context)}`
      }
      return `● ${renderInlineNodes(block.children, context)}`
    case 'paragraph':
      return renderParagraph(block, context)
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
  return blocks
    .map((block) => renderBlock(block, context))
    .filter((output) => output.length > 0)
    .join('\n\n')
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
