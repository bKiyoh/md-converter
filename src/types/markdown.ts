export type SourceLocation = {
  line: number
  column: number
}

type MarkdownNode = {
  location?: SourceLocation
}

export type MarkdownDocument = {
  blocks: BlockNode[]
}

export type BlockNode =
  | HeadingNode
  | ParagraphNode
  | ListNode
  | QuoteNode
  | CodeBlockNode
  | TableNode
  | ThematicBreakNode
  | RawHtmlBlockNode

export type InlineNode =
  | TextNode
  | StrongNode
  | EmphasisNode
  | DeleteNode
  | InlineCodeNode
  | LinkNode
  | LineBreakNode
  | RawHtmlInlineNode

export type HeadingNode = MarkdownNode & {
  type: 'heading'
  depth: 1 | 2 | 3 | 4 | 5 | 6
  children: InlineNode[]
}

export type ParagraphNode = MarkdownNode & {
  type: 'paragraph'
  children: InlineNode[]
}

export type ListNode = MarkdownNode & {
  type: 'list'
  ordered: boolean
  start: number | null
  spread: boolean
  items: ListItemNode[]
}

export type ListItemNode = MarkdownNode & {
  type: 'listItem'
  checked: boolean | null
  spread: boolean
  children: BlockNode[]
}

export type QuoteNode = MarkdownNode & {
  type: 'quote'
  children: BlockNode[]
}

export type CodeBlockNode = MarkdownNode & {
  type: 'codeBlock'
  value: string
  language: string | null
  meta: string | null
}

export type TableAlignment = 'left' | 'center' | 'right' | null

export type TableNode = MarkdownNode & {
  type: 'table'
  align: TableAlignment[]
  header: TableRowNode
  rows: TableRowNode[]
}

export type TableRowNode = MarkdownNode & {
  type: 'tableRow'
  cells: TableCellNode[]
}

export type TableCellNode = MarkdownNode & {
  type: 'tableCell'
  children: InlineNode[]
}

export type ThematicBreakNode = MarkdownNode & {
  type: 'thematicBreak'
}

export type RawHtmlBlockNode = MarkdownNode & {
  type: 'rawHtmlBlock'
  value: string
}

export type TextNode = MarkdownNode & {
  type: 'text'
  value: string
}

export type StrongNode = MarkdownNode & {
  type: 'strong'
  children: InlineNode[]
}

export type EmphasisNode = MarkdownNode & {
  type: 'emphasis'
  children: InlineNode[]
}

export type DeleteNode = MarkdownNode & {
  type: 'delete'
  children: InlineNode[]
}

export type InlineCodeNode = MarkdownNode & {
  type: 'inlineCode'
  value: string
}

export type LinkNode = MarkdownNode & {
  type: 'link'
  url: string
  title: string | null
  children: InlineNode[]
}

export type LineBreakNode = MarkdownNode & {
  type: 'lineBreak'
  kind: 'soft' | 'hard'
}

export type RawHtmlInlineNode = MarkdownNode & {
  type: 'rawHtmlInline'
  value: string
}
