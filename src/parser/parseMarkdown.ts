import type { Root } from 'mdast'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import type { MarkdownDocument } from '../types/markdown'
import { normalizeMarkdownAst } from './normalizeMarkdownAst'

const markdownParser = unified().use(remarkParse).use(remarkGfm)

export function parseMarkdown(markdown: string): MarkdownDocument {
  const tree = markdownParser.parse(markdown) as Root
  return normalizeMarkdownAst(tree)
}
