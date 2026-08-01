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
import { formatUnsupportedInlineFallback } from '../../utils/unsupportedMarkdown'
import { addRawHtmlWarning } from '../rawHtmlWarning'
import { addUnsupportedInlineWarning } from '../unsupportedInline'

type RenderContext = {
  warnings: ConversionWarning[]
}

type InlineRenderMode = 'markup' | 'plain'

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
  mode: InlineRenderMode,
): string {
  switch (node.type) {
    case 'text':
      return node.value
    case 'strong': {
      const content = renderInlineNodes(node.children, context, mode)
      return mode === 'markup' ? `*${content}*` : content
    }
    case 'emphasis': {
      const content = renderInlineNodes(node.children, context, mode)
      return mode === 'markup' ? `_${content}_` : content
    }
    case 'delete': {
      const content = renderInlineNodes(node.children, context, mode)
      return mode === 'markup' ? `~${content}~` : content
    }
    case 'inlineCode':
      return mode === 'markup' ? `\`${node.value}\`` : node.value
    case 'link': {
      const label = renderInlineNodes(node.children, context, mode)
      return `[${label}](${node.url})`
    }
    case 'image':
    case 'footnoteReference':
      addUnsupportedInlineWarning(context.warnings, node)
      return formatUnsupportedInlineFallback(node)
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
  mode: InlineRenderMode = 'markup',
): string {
  return nodes.map((node) => renderInlineNode(node, context, mode)).join('')
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
    marker = item.checked ? '☑ ' : '☐ '
    addLossyWarning(
      context,
      'Slackでは操作可能なチェックボックスを表現できないため、状態を記号に変換しました。',
      item.location,
    )
  } else if (list.ordered) {
    marker = `${(list.start ?? 1) + itemIndex}. `
  } else {
    marker = '- '
  }

  const [firstChild, ...remainingChildren] = item.children
  const lines: string[] = []

  if (firstChild?.type === 'list') {
    lines.push(`${indent}${marker.trimEnd()}`)
    lines.push(renderList(firstChild, depth + 1, context))
  } else if (firstChild) {
    const content = renderBlock(firstChild, context)
    const continuationIndent = `${indent}  `
    lines.push(`${indent}${marker}${indentContinuationLines(content, continuationIndent)}`)
  } else {
    lines.push(`${indent}${marker.trimEnd()}`)
  }

  for (const child of remainingChildren) {
    if (child.type === 'list') {
      lines.push(renderList(child, depth + 1, context))
    } else {
      const childIndent = `${indent}  `
      lines.push(childIndent + renderBlock(child, context).split('\n').join(`\n${childIndent}`))
    }
  }

  return lines.join('\n')
}

function renderList(list: ListNode, depth: number, context: RenderContext): string {
  return list.items
    .map((item, index) => renderListItem(item, list, index, depth, context))
    .join('\n')
}

function renderTableRow(
  cells: TableNode['header']['cells'],
  context: RenderContext,
): string {
  const values = cells.map((cell) => renderInlineNodes(cell.children, context, 'plain'))
  return `| ${values.join(' | ')} |`
}

function renderTable(table: TableNode, context: RenderContext): string {
  addLossyWarning(
    context,
    'Slackではテーブルを直接表現できないため、コードブロック形式に変換しました。列配置とセル内装飾は保持されません。',
    table.location,
  )

  const separator = `| ${table.header.cells.map(() => '---').join(' | ')} |`
  const rows = [
    renderTableRow(table.header.cells, context),
    separator,
    ...table.rows.map((row) => renderTableRow(row.cells, context)),
  ]

  return `\`\`\`\n${rows.join('\n')}\n\`\`\``
}

function renderQuote(blocks: BlockNode[], context: RenderContext): string {
  return renderBlocks(blocks, context)
    .split('\n')
    .map((line) => (line.length > 0 ? `> ${line}` : '>'))
    .join('\n')
}

function renderBlock(block: BlockNode, context: RenderContext): string {
  switch (block.type) {
    case 'heading':
      addLossyWarning(
        context,
        'Slackでは見出しレベルを表現できないため、太字に変換しました。',
        block.location,
      )
      return `*${renderInlineNodes(block.children, context)}*`
    case 'paragraph':
      return renderInlineNodes(block.children, context)
    case 'list':
      return renderList(block, 0, context)
    case 'quote':
      return renderQuote(block.children, context)
    case 'codeBlock':
      if (block.language !== null || block.meta !== null) {
        addLossyWarning(
          context,
          'Slackのコードブロックでは言語名とメタ情報を保持できないため、省略しました。',
          block.location,
        )
      }
      return `\`\`\`\n${block.value}\n\`\`\``
    case 'table':
      return renderTable(block, context)
    case 'thematicBreak':
      addLossyWarning(
        context,
        'Slackでは水平線を直接表現できないため、罫線文字に変換しました。',
        block.location,
      )
      return '──────────'
    case 'rawHtmlBlock':
      addRawHtmlWarning(context.warnings, block.location)
      return block.value
  }
}

function renderBlocks(blocks: BlockNode[], context: RenderContext): string {
  return blocks.map((block) => renderBlock(block, context)).join('\n\n')
}

export function convertToSlack(document: MarkdownDocument): ConversionResult {
  const context: RenderContext = { warnings: [] }

  return {
    output: renderBlocks(document.blocks, context),
    warnings: context.warnings,
  }
}

export const slackConverter: Converter = {
  format: 'slack',
  convert: convertToSlack,
}
