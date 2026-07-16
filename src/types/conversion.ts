import type { MarkdownDocument, SourceLocation } from './markdown'

export const OUTPUT_FORMATS = [
  'slack',
  'backlog-markdown',
  'backlog-notation',
  'plain-text',
] as const

export type OutputFormat = (typeof OUTPUT_FORMATS)[number]

export function isOutputFormat(value: unknown): value is OutputFormat {
  return typeof value === 'string' && OUTPUT_FORMATS.some((format) => format === value)
}

export type WarningCode = 'unsupported-node' | 'lossy-conversion' | 'invalid-structure'

export type ConversionWarning = {
  code: WarningCode
  message: string
  location?: SourceLocation
}

export type ConversionResult = {
  output: string
  warnings: ConversionWarning[]
}

export interface Converter {
  readonly format: OutputFormat
  convert(document: MarkdownDocument): ConversionResult
}
