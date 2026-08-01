import type { ConversionWarning } from '../types/conversion'
import type {
  FootnoteReferenceNode,
  ImageNode,
  SourceLocation,
} from '../types/markdown'

type UnsupportedInlineNode = ImageNode | FootnoteReferenceNode

function addWarning(
  warnings: ConversionWarning[],
  code: ConversionWarning['code'],
  message: string,
  location?: SourceLocation,
): void {
  warnings.push({
    code,
    message,
    ...(location ? { location } : {}),
  })
}

export function addUnsupportedInlineWarning(
  warnings: ConversionWarning[],
  node: UnsupportedInlineNode,
): void {
  if (node.type === 'image') {
    addWarning(
      warnings,
      'unsupported-image',
      '画像には対応していないため、代替テキストとURLを文字列として保持しました。',
      node.location,
    )
    return
  }

  addWarning(
    warnings,
    'unsupported-footnote',
    '脚注参照には対応していないため、参照ラベルを文字列として保持しました。',
    node.location,
  )
}
