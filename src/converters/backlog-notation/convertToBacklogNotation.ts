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

type InlineRenderContext = {
  renderContext: RenderContext
  decorationDepth: number
}

function addWarning(
  context: RenderContext,
  code: ConversionWarning['code'],
  message: string,
  location?: SourceLocation,
): void {
  context.warnings.push({
    code,
    message,
    ...(location ? { location } : {}),
  })
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/[%\'\[\]{}|&*+>#-]/g, '\\\\$&')
}

function renderNestedDecoration(
  node: Extract<InlineNode, { type: 'strong' | 'emphasis' | 'delete' }>,
  context: InlineRenderContext,
  opening: string,
  closing: string,
): string {
  if (context.decorationDepth > 0) {
    addWarning(
      context.renderContext,
      'lossy-conversion',
      'Backlog記法では装飾の入れ子を公式仕様で確認できないため、内側の装飾をプレーンテキストに変換しました。',
      node.location,
    )
    return renderInlineNodes(node.children, context)
  }

  const childContext: InlineRenderContext = {
    ...context,
    decorationDepth: context.decorationDepth + 1,
  }
  return `${opening}${renderInlineNodes(node.children, childContext)}${closing}`
}

function escapeLinkUrl(url: string): string {
  return url.replace(/\\/g, '\\\\').replace(/\]/g, '\\\\]')
}

function renderInlineNode(node: InlineNode, context: InlineRenderContext): string {
  switch (node.type) {
    case 'text':
      return escapeText(node.value)
    case 'strong':
      return renderNestedDecoration(node, context, "''", "''")
    case 'emphasis':
      return renderNestedDecoration(node, context, "'''", "'''")
    case 'delete':
      return renderNestedDecoration(node, context, '%%', '%%')
    case 'inlineCode':
      addWarning(
        context.renderContext,
        'lossy-conversion',
        'Backlog記法ではインラインコードを公式仕様で確認できないため、コード本文をプレーンテキストに変換しました。',
        node.location,
      )
      return escapeText(node.value)
    case 'link': {
      if (node.title !== null) {
        addWarning(
          context.renderContext,
          'lossy-conversion',
          'Backlog記法のリンクではタイトルを保持できないため、省略しました。',
          node.location,
        )
      }

      return `[[${renderInlineNodes(node.children, context)}:${escapeLinkUrl(node.url)}]]`
    }
    case 'image':
    case 'footnoteReference':
      addUnsupportedInlineWarning(context.renderContext.warnings, node)
      return escapeText(formatUnsupportedInlineFallback(node))
    case 'lineBreak':
      return '&br;'
    case 'rawHtmlInline':
      addRawHtmlWarning(context.renderContext.warnings, node.location)
      return escapeText(node.value)
  }
}

function renderInlineNodes(nodes: InlineNode[], context: InlineRenderContext): string {
  return nodes.map((node) => renderInlineNode(node, context)).join('')
}

function renderListItem(
  item: ListItemNode,
  list: ListNode,
  depth: number,
  context: RenderContext,
): string {
  const isChecklist = item.checked !== null
  const markerCharacter = isChecklist ? '-' : list.ordered ? '+' : '-'
  const marker = markerCharacter.repeat(depth + 1)
  const checkbox = item.checked === null ? '' : item.checked ? '[x] ' : '[ ] '

  if (isChecklist) {
    addWarning(
      context,
      'lossy-conversion',
      'Backlogのチェックリストは課題詳細でのみ操作できます。コメントやWikiでは通常のリストとして表示される場合があります。',
      item.location,
    )
    if (list.ordered) {
      addWarning(
        context,
        'lossy-conversion',
        'Backlog記法では番号付きチェックリストを公式仕様で確認できないため、箇条書きのチェックリストに変換しました。',
        item.location,
      )
    }
  }

  const [firstChild, ...remainingChildren] = item.children
  const sections: string[] = []

  if (firstChild?.type === 'list') {
    sections.push(marker)
    sections.push(renderList(firstChild, depth + 1, context))
  } else if (firstChild) {
    sections.push(`${marker} ${checkbox}${renderBlock(firstChild, context)}`)
  } else {
    sections.push(`${marker} ${checkbox}`.trimEnd())
  }

  for (const child of remainingChildren) {
    if (child.type === 'list') {
      sections.push(renderList(child, depth + 1, context))
    } else {
      addWarning(
        context,
        'lossy-conversion',
        'Backlog記法ではリスト項目内の複数ブロックの所属を保持できないため、後続ブロックをリスト外へ出力しました。',
        child.location ?? item.location,
      )
      sections.push(renderBlock(child, context))
    }
  }

  return sections.join('\n')
}

function renderList(list: ListNode, depth: number, context: RenderContext): string {
  if (list.ordered && (list.start ?? 1) !== 1) {
    addWarning(
      context,
      'lossy-conversion',
      'Backlog記法の番号付きリストでは開始番号を指定できないため、1から始まるリストに変換しました。',
      list.location,
    )
  }

  return list.items.map((item) => renderListItem(item, list, depth, context)).join('\n')
}

function renderTableRow(
  cells: TableNode['header']['cells'],
  context: RenderContext,
  header: boolean,
): string {
  const inlineContext: InlineRenderContext = {
    renderContext: context,
    decorationDepth: 0,
  }
  const values = cells.map((cell) => renderInlineNodes(cell.children, inlineContext))
  return `| ${values.join(' | ')} |${header ? 'h' : ''}`
}

function renderTable(table: TableNode, context: RenderContext): string {
  if (table.align.some((alignment) => alignment !== null)) {
    addWarning(
      context,
      'lossy-conversion',
      'Backlog記法のテーブルでは列配置を保持できないため、省略しました。',
      table.location,
    )
  }

  return [
    renderTableRow(table.header.cells, context, true),
    ...table.rows.map((row) => renderTableRow(row.cells, context, false)),
  ].join('\n')
}

function renderCodeBlock(
  block: Extract<BlockNode, { type: 'codeBlock' }>,
  context: RenderContext,
): string {
  const supportedLanguage = block.language === 'java' || block.language === 'cs'

  if ((block.language !== null && !supportedLanguage) || block.meta !== null) {
    addWarning(
      context,
      'lossy-conversion',
      'Backlog記法で公式確認できないコードブロックの言語名またはメタ情報を省略しました。',
      block.location,
    )
  }

  let value = block.value
  if (value.includes('{/code}')) {
    addWarning(
      context,
      'invalid-structure',
      'コード本文の終了マクロをBacklog記法のエスケープで保護しました。貼り付け後に内容を確認してください。',
      block.location,
    )
    value = value.replaceAll('{/code}', '\\\\{/code}')
  }

  const language = supportedLanguage ? `:${block.language}` : ''
  return `{code${language}}\n${value}\n{/code}`
}

function renderQuote(blocks: BlockNode[], context: RenderContext): string {
  return renderBlocks(blocks, context)
    .split('\n')
    .map((line) => (line.length > 0 ? `>${line}` : '>'))
    .join('\n')
}

function renderBlock(block: BlockNode, context: RenderContext): string {
  const inlineContext: InlineRenderContext = {
    renderContext: context,
    decorationDepth: 0,
  }

  switch (block.type) {
    case 'heading': {
      const depth = Math.min(block.depth, 3)
      if (block.depth > 3) {
        addWarning(
          context,
          'lossy-conversion',
          'Backlog記法では見出しレベル4〜6を公式仕様で確認できないため、見出しレベル3に変換しました。',
          block.location,
        )
      }
      return `${'*'.repeat(depth)} ${renderInlineNodes(block.children, inlineContext)}`
    }
    case 'paragraph':
      return renderInlineNodes(block.children, inlineContext)
    case 'list':
      return renderList(block, 0, context)
    case 'quote':
      return renderQuote(block.children, context)
    case 'codeBlock':
      return renderCodeBlock(block, context)
    case 'table':
      return renderTable(block, context)
    case 'thematicBreak':
      addWarning(
        context,
        'lossy-conversion',
        'Backlog記法では水平線を公式仕様で確認できないため、罫線文字に変換しました。',
        block.location,
      )
      return '──────────'
    case 'rawHtmlBlock':
      addRawHtmlWarning(context.warnings, block.location)
      return escapeText(block.value)
  }
}

function renderBlocks(blocks: BlockNode[], context: RenderContext): string {
  return blocks.map((block) => renderBlock(block, context)).join('\n\n')
}

export function convertToBacklogNotation(document: MarkdownDocument): ConversionResult {
  const context: RenderContext = { warnings: [] }

  return {
    output: renderBlocks(document.blocks, context),
    warnings: context.warnings,
  }
}

export const backlogNotationConverter: Converter = {
  format: 'backlog-notation',
  convert: convertToBacklogNotation,
}
