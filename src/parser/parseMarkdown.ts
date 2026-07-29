import type { Root } from 'mdast'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import type { MarkdownDocument } from '../types/markdown'
import { normalizeMarkdownAst } from './normalizeMarkdownAst'

const markdownParser = unified().use(remarkParse).use(remarkGfm)

export function parseMarkdownAst(markdown: string): Root {
  return markdownParser.parse(markdown) as Root
}

export function parseMarkdown(markdown: string): MarkdownDocument {
  return normalizeMarkdownAst(parseMarkdownAst(markdown))
}

export function parseMarkdownForPreview(markdown: string): MarkdownDocument {
  return normalizeMarkdownAst(parseMarkdownAst(markdown), { ignoreHtml: true })
}
