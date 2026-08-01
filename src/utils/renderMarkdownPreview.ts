import type {
  BlockNode,
  InlineNode,
  ListItemNode,
  MarkdownDocument,
  TableCellNode,
} from '../types/markdown'
import { formatUnsupportedInlineFallback } from './unsupportedMarkdown'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function getSafeLinkUrl(url: string): string | null {
  const normalized = url.trim()

  if (/[\u0000-\u001f\u007f]/u.test(normalized)) {
    return null
  }

  try {
    const parsed = new URL(normalized, 'https://preview.invalid')
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol) ? normalized : null
  } catch {
    return null
  }
}

function renderInline(node: InlineNode): string {
  switch (node.type) {
    case 'text':
      return escapeHtml(node.value)
    case 'strong':
      return `<strong>${renderInlines(node.children)}</strong>`
    case 'emphasis':
      return `<em>${renderInlines(node.children)}</em>`
    case 'delete':
      return `<del>${renderInlines(node.children)}</del>`
    case 'inlineCode':
      return `<code>${escapeHtml(node.value)}</code>`
    case 'link': {
      const contents = renderInlines(node.children)
      const safeUrl = getSafeLinkUrl(node.url)
      if (safeUrl === null) {
        return contents
      }

      const title = node.title === null ? '' : ` title="${escapeHtml(node.title)}"`
      return `<a href="${escapeHtml(safeUrl)}"${title}>${contents}</a>`
    }
    case 'image':
    case 'footnoteReference':
      return escapeHtml(formatUnsupportedInlineFallback(node))
    case 'lineBreak':
      return node.kind === 'hard' ? '<br>' : '\n'
    case 'rawHtmlInline':
      return ''
  }
}

function renderInlines(nodes: InlineNode[]): string {
  return nodes.map(renderInline).join('')
}

function renderListItem(item: ListItemNode): string {
  const checkbox =
    item.checked === null
      ? ''
      : `<input type="checkbox" disabled${item.checked ? ' checked' : ''}> `
  return `<li>${checkbox}${item.children.map(renderBlock).join('\n')}</li>`
}

function renderTableCell(cell: TableCellNode, tag: 'th' | 'td'): string {
  return `<${tag}>${renderInlines(cell.children)}</${tag}>`
}

function renderBlock(node: BlockNode): string {
  switch (node.type) {
    case 'heading':
      return `<h${node.depth}>${renderInlines(node.children)}</h${node.depth}>`
    case 'paragraph':
      return `<p>${renderInlines(node.children)}</p>`
    case 'list': {
      const tag = node.ordered ? 'ol' : 'ul'
      const start = node.ordered && node.start !== null && node.start !== 1 ? ` start="${node.start}"` : ''
      return `<${tag}${start}>${node.items.map(renderListItem).join('')}</${tag}>`
    }
    case 'quote':
      return `<blockquote>${node.children.map(renderBlock).join('\n')}</blockquote>`
    case 'codeBlock': {
      const language = node.language ? ` class="language-${escapeHtml(node.language)}"` : ''
      return `<pre><code${language}>${escapeHtml(node.value)}</code></pre>`
    }
    case 'table':
      return `<table><thead><tr>${node.header.cells
        .map((cell) => renderTableCell(cell, 'th'))
        .join('')}</tr></thead><tbody>${node.rows
        .map(
          (row) =>
            `<tr>${row.cells.map((cell) => renderTableCell(cell, 'td')).join('')}</tr>`,
        )
        .join('')}</tbody></table>`
    case 'thematicBreak':
      return '<hr>'
    case 'rawHtmlBlock':
      return ''
  }
}

export function renderMarkdownPreview(document: MarkdownDocument): string {
  return document.blocks.map(renderBlock).join('\n')
}
