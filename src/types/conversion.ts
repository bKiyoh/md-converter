import type { MarkdownDocument, SourceLocation } from './markdown'

export const OUTPUT_FORMATS = [
  'backlog-notation',
  'backlog-markdown',
  'slack',
  'plain-text',
] as const

export type OutputFormat = (typeof OUTPUT_FORMATS)[number]

export function isOutputFormat(value: unknown): value is OutputFormat {
  return typeof value === 'string' && OUTPUT_FORMATS.some((format) => format === value)
}

export type WarningCode =
  | 'unsupported-node'
  | 'unsupported-image'
  | 'unsupported-footnote'
  | 'lossy-conversion'
  | 'invalid-structure'

export type ConversionWarning = {
  code: WarningCode
  message: string
  location?: SourceLocation
}

export type ConversionSourcePosition = {
  sourceLine: number
  outputLine: number
}

export type ConversionOptions = {
  includeSourceMap?: boolean
}

export type ConversionResult = {
  output: string
  warnings: ConversionWarning[]
  sourceMap?: ConversionSourcePosition[]
}

export interface Converter {
  readonly format: OutputFormat
  convert(document: MarkdownDocument, options?: ConversionOptions): ConversionResult
}
