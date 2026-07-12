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
  TableAlignment,
  TableNode,
} from '../../types/markdown'

type RenderContext = {
  warnings: ConversionWarning[]
}

type InlineRenderContext = {
  inTable: boolean
}

const defaultInlineContext: InlineRenderContext = { inTable: false }

function addChecklistScopeWarning(
  context: RenderContext,
  location?: SourceLocation,
): void {
  context.warnings.push({
    code: 'lossy-conversion',
    message:
      'Backlogのチェックリストは課題詳細でのみ操作できます。コメントやWikiでは通常のリストとして表示される場合があります。',
    ...(location ? { location } : {}),
  })
}

function escapeText(value: string, context: InlineRenderContext): string {
  const escaped = value.replace(/[\\`*_[\]~<>]/g, '\\$&')
  return context.inTable ? escaped.replace(/\|/g, '\\|') : escaped
}

function renderInlineCode(value: string): string {
  const longestBacktickRun = Math.max(
    0,
    ...(value.match(/`+/g) ?? []).map((run) => run.length),
  )
  const fence = '`'.repeat(Math.max(1, longestBacktickRun + 1))
  const needsPadding =
    value.startsWith('`') ||
    value.endsWith('`') ||
    (value.startsWith(' ') && value.endsWith(' ') && value.trim().length > 0)
  const padding = needsPadding ? ' ' : ''

  return `${fence}${padding}${value}${padding}${fence}`
}

function renderLinkDestination(url: string): string {
  if (/[\s()]/.test(url)) {
    return `<${url.replace(/[<>]/g, '\\$&')}>`
  }

  return url
}

function renderLinkTitle(title: string): string {
  return title.replace(/[\\"]/g, '\\$&')
}

function renderInlineNode(node: InlineNode, context: InlineRenderContext): string {
  switch (node.type) {
    case 'text':
      return escapeText(node.value, context)
    case 'strong':
      return `**${renderInlineNodes(node.children, context)}**`
    case 'emphasis':
      return `*${renderInlineNodes(node.children, context)}*`
    case 'delete':
      return `~~${renderInlineNodes(node.children, context)}~~`
    case 'inlineCode':
      return renderInlineCode(node.value)
    case 'link': {
      const label = renderInlineNodes(node.children, context)
      const title = node.title === null ? '' : ` "${renderLinkTitle(node.title)}"`
      return `[${label}](${renderLinkDestination(node.url)}${title})`
    }
    case 'lineBreak':
      return node.kind === 'hard' ? '  \n' : '\n'
  }
}

function renderInlineNodes(
  nodes: InlineNode[],
  context: InlineRenderContext = defaultInlineContext,
): string {
  return nodes.map((node) => renderInlineNode(node, context)).join('')
}

function escapeParagraphLineStarts(value: string): string {
  return value
    .replace(/^( {0,3})([#>+])(?=\s)/gm, '$1\\$2')
    .replace(/^( {0,3})-(?=\s|$)/gm, '$1\\-')
    .replace(/^( {0,3})(\d+)\.(?=\s)/gm, '$1$2\\.')
}

function indentLines(value: string, indent: string): string {
  return value
    .split('\n')
    .map((line) => `${indent}${line}`)
    .join('\n')
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
  const indent = '    '.repeat(depth)
  const continuationIndent = '    '.repeat(depth + 1)
  const number = (list.start ?? 1) + itemIndex
  const marker = list.ordered ? `${number}. ` : '- '
  const checkbox = item.checked === null ? '' : item.checked ? '[x] ' : '[ ] '

  if (item.checked !== null) {
    addChecklistScopeWarning(context, item.location)
  }

  const [firstChild, ...remainingChildren] = item.children
  const sections: string[] = []

  if (firstChild?.type === 'list') {
    sections.push(`${indent}${marker}${checkbox}`.trimEnd())
    sections.push(renderList(firstChild, depth + 1, context))
  } else if (firstChild) {
    const content = renderBlock(firstChild, context)
    sections.push(
      `${indent}${marker}${checkbox}${indentContinuationLines(content, continuationIndent)}`,
    )
  } else {
    sections.push(`${indent}${marker}${checkbox}`.trimEnd())
  }

  for (const child of remainingChildren) {
    if (child.type === 'list') {
      sections.push(renderList(child, depth + 1, context))
    } else {
      sections.push(indentLines(renderBlock(child, context), continuationIndent))
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

function renderTableAlignment(alignment: TableAlignment): string {
  switch (alignment) {
    case 'left':
      return ':---'
    case 'center':
      return ':---:'
    case 'right':
      return '---:'
    case null:
      return '---'
  }
}

function renderTableRow(cells: TableNode['header']['cells']): string {
  const values = cells.map((cell) => renderInlineNodes(cell.children, { inTable: true }))
  return `| ${values.join(' | ')} |`
}

function renderTable(table: TableNode): string {
  const separator = `| ${table.align.map(renderTableAlignment).join(' | ')} |`
  return [
    renderTableRow(table.header.cells),
    separator,
    ...table.rows.map((row) => renderTableRow(row.cells)),
  ].join('\n')
}

function renderCodeBlock(block: Extract<BlockNode, { type: 'codeBlock' }>): string {
  const longestBacktickRun = Math.max(
    0,
    ...(block.value.match(/`+/g) ?? []).map((run) => run.length),
  )
  const fence = '`'.repeat(Math.max(3, longestBacktickRun + 1))
  const info = [block.language, block.meta].filter((value) => value !== null).join(' ')

  return `${fence}${info}\n${block.value}\n${fence}`
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
      return `${'#'.repeat(block.depth)} ${renderInlineNodes(block.children)}`
    case 'paragraph':
      return escapeParagraphLineStarts(renderInlineNodes(block.children))
    case 'list':
      return renderList(block, 0, context)
    case 'quote':
      return renderQuote(block.children, context)
    case 'codeBlock':
      return renderCodeBlock(block)
    case 'table':
      return renderTable(block)
    case 'thematicBreak':
      return '---'
  }
}

function renderBlocks(blocks: BlockNode[], context: RenderContext): string {
  return blocks.map((block) => renderBlock(block, context)).join('\n\n')
}

export function convertToBacklogMarkdown(document: MarkdownDocument): ConversionResult {
  const context: RenderContext = { warnings: [] }

  return {
    output: renderBlocks(document.blocks, context),
    warnings: context.warnings,
  }
}

export const backlogMarkdownConverter: Converter = {
  format: 'backlog-markdown',
  convert: convertToBacklogMarkdown,
}
