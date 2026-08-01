import type { FootnoteReferenceNode, ImageNode } from '../types/markdown'

type UnsupportedInlineNode = ImageNode | FootnoteReferenceNode

export function formatUnsupportedInlineFallback(node: UnsupportedInlineNode): string {
  if (node.type === 'image') {
    const description = node.alt.trim().length > 0 ? node.alt : '説明なし'
    return node.url === null
      ? `画像: ${description}`
      : `画像: ${description} (${node.url})`
  }

  return `脚注参照: ${node.label}`
}
