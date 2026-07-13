import type { ConversionWarning } from '../types/conversion'
import type { SourceLocation } from '../types/markdown'

export const RAW_HTML_WARNING_MESSAGE =
  '生HTMLには対応していないため、文字列として保持しました。'

export function addRawHtmlWarning(
  warnings: ConversionWarning[],
  location?: SourceLocation,
): void {
  warnings.push({
    code: 'unsupported-node',
    message: RAW_HTML_WARNING_MESSAGE,
    ...(location ? { location } : {}),
  })
}
