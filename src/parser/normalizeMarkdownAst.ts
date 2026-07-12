import type {
  BlockContent,
  Definition,
  LinkReference,
  ListItem,
  PhrasingContent,
  Root,
  RootContent,
  TableCell,
  TableRow,
  Text,
} from 'mdast'
import type {
  BlockNode,
  InlineNode,
  MarkdownDocument,
  SourceLocation,
  TableCellNode,
  TableRowNode,
  TextNode,
} from '../types/markdown'

type NormalizationContext = {
  definitions: Map<string, Definition>
  ignoreHtml: boolean
}

export type MarkdownNormalizationOptions = {
  ignoreHtml?: boolean
}

type SourcePoint = {
  line: number
  column: number
}

function toLocation(point: SourcePoint | undefined): SourceLocation | undefined {
  return point ? { line: point.line, column: point.column } : undefined
}

function withLocation<T extends object>(value: T, point: SourcePoint | undefined): T & {
  location?: SourceLocation
} {
  const location = toLocation(point)
  return location ? { ...value, location } : value
}

function normalizeText(node: Text): InlineNode[] {
  const lines = node.value.split('\n')

  if (lines.length === 1) {
    return [withLocation<TextNode>({ type: 'text', value: node.value }, node.position?.start)]
  }

  const result: InlineNode[] = []
  lines.forEach((line, index) => {
    const lineStart = node.position?.start
      ? {
          line: node.position.start.line + index,
          column: index === 0 ? node.position.start.column : 1,
        }
      : undefined

    if (line.length > 0) {
      result.push(withLocation<TextNode>({ type: 'text', value: line }, lineStart))
    }

    if (index < lines.length - 1) {
      result.push(withLocation({ type: 'lineBreak' as const, kind: 'soft' as const }, lineStart))
    }
  })

  return result
}

function normalizeLinkReference(
  node: LinkReference,
  context: NormalizationContext,
): InlineNode {
  const definition = context.definitions.get(node.identifier)

  if (!definition) {
    throw new Error(`参照リンクの定義が見つかりません: ${node.identifier}`)
  }

  return withLocation(
    {
      type: 'link' as const,
      url: definition.url,
      title: definition.title ?? null,
      children: normalizeInlineNodes(node.children, context),
    },
    node.position?.start,
  )
}

function normalizeInlineNode(
  node: PhrasingContent,
  context: NormalizationContext,
): InlineNode[] {
  switch (node.type) {
    case 'text':
      return normalizeText(node)
    case 'strong':
      return [
        withLocation(
          { type: 'strong' as const, children: normalizeInlineNodes(node.children, context) },
          node.position?.start,
        ),
      ]
    case 'emphasis':
      return [
        withLocation(
          { type: 'emphasis' as const, children: normalizeInlineNodes(node.children, context) },
          node.position?.start,
        ),
      ]
    case 'delete':
      return [
        withLocation(
          { type: 'delete' as const, children: normalizeInlineNodes(node.children, context) },
          node.position?.start,
        ),
      ]
    case 'inlineCode':
      return [
        withLocation({ type: 'inlineCode' as const, value: node.value }, node.position?.start),
      ]
    case 'link':
      return [
        withLocation(
          {
            type: 'link' as const,
            url: node.url,
            title: node.title ?? null,
            children: normalizeInlineNodes(node.children, context),
          },
          node.position?.start,
        ),
      ]
    case 'linkReference':
      return [normalizeLinkReference(node, context)]
    case 'break':
      return [withLocation({ type: 'lineBreak' as const, kind: 'hard' as const }, node.position?.start)]
    case 'html':
      if (context.ignoreHtml) {
        return []
      }
      throw new Error('MVP対象外のインラインノードです: html')
    case 'image':
    case 'imageReference':
    case 'footnoteReference':
      throw new Error(`MVP対象外のインラインノードです: ${node.type}`)
  }
}

function normalizeInlineNodes(
  nodes: PhrasingContent[],
  context: NormalizationContext,
): InlineNode[] {
  return nodes.flatMap((node) => normalizeInlineNode(node, context))
}

function normalizeTableCell(
  node: TableCell,
  context: NormalizationContext,
): TableCellNode {
  return withLocation(
    { type: 'tableCell', children: normalizeInlineNodes(node.children, context) },
    node.position?.start,
  )
}

function normalizeTableRow(node: TableRow, context: NormalizationContext): TableRowNode {
  return withLocation(
    {
      type: 'tableRow',
      cells: node.children.map((cell) => normalizeTableCell(cell, context)),
    },
    node.position?.start,
  )
}

function normalizeListItem(node: ListItem, context: NormalizationContext) {
  return withLocation(
    {
      type: 'listItem' as const,
      checked: node.checked ?? null,
      spread: node.spread ?? false,
      children: normalizeBlockNodes(node.children, context),
    },
    node.position?.start,
  )
}

function isBlockContent(node: RootContent): node is BlockContent {
  return [
    'heading',
    'paragraph',
    'list',
    'blockquote',
    'code',
    'table',
    'thematicBreak',
    'html',
  ].includes(node.type)
}

function normalizeBlockNodes(
  nodes: RootContent[],
  context: NormalizationContext,
): BlockNode[] {
  return nodes
    .filter(isBlockContent)
    .flatMap((node) => {
      const normalized = normalizeBlockNode(node, context)
      return normalized ? [normalized] : []
    })
}

function normalizeBlockNode(
  node: BlockContent,
  context: NormalizationContext,
): BlockNode | null {
  switch (node.type) {
    case 'heading':
      return withLocation(
        {
          type: 'heading' as const,
          depth: node.depth,
          children: normalizeInlineNodes(node.children, context),
        },
        node.position?.start,
      )
    case 'paragraph':
      return withLocation(
        { type: 'paragraph' as const, children: normalizeInlineNodes(node.children, context) },
        node.position?.start,
      )
    case 'list':
      return withLocation(
        {
          type: 'list' as const,
          ordered: node.ordered ?? false,
          start: node.ordered ? (node.start ?? 1) : null,
          spread: node.spread ?? false,
          items: node.children.map((item) => normalizeListItem(item, context)),
        },
        node.position?.start,
      )
    case 'blockquote':
      return withLocation(
        {
          type: 'quote' as const,
          children: normalizeBlockNodes(node.children, context),
        },
        node.position?.start,
      )
    case 'code':
      return withLocation(
        {
          type: 'codeBlock' as const,
          value: node.value,
          language: node.lang ?? null,
          meta: node.meta ?? null,
        },
        node.position?.start,
      )
    case 'table': {
      const [header, ...rows] = node.children
      if (!header) {
        throw new Error('ヘッダーのないテーブルは正規化できません')
      }

      return withLocation(
        {
          type: 'table' as const,
          align: node.align ?? Array.from({ length: header.children.length }, () => null),
          header: normalizeTableRow(header, context),
          rows: rows.map((row) => normalizeTableRow(row, context)),
        },
        node.position?.start,
      )
    }
    case 'thematicBreak':
      return withLocation({ type: 'thematicBreak' as const }, node.position?.start)
    case 'html':
      if (context.ignoreHtml) {
        return null
      }
      throw new Error('MVP対象外のブロックノードです: html')
  }
}

function collectDefinitions(nodes: RootContent[], definitions: Map<string, Definition>): void {
  for (const node of nodes) {
    if (node.type === 'definition') {
      definitions.set(node.identifier, node)
    } else if (node.type === 'blockquote') {
      collectDefinitions(node.children, definitions)
    } else if (node.type === 'list') {
      for (const item of node.children) {
        collectDefinitions(item.children, definitions)
      }
    }
  }
}

export function normalizeMarkdownAst(
  tree: Root,
  options: MarkdownNormalizationOptions = {},
): MarkdownDocument {
  const definitions = new Map<string, Definition>()
  collectDefinitions(tree.children, definitions)
  const context: NormalizationContext = {
    definitions,
    ignoreHtml: options.ignoreHtml ?? false,
  }

  return {
    blocks: normalizeBlockNodes(tree.children, context),
  }
}
