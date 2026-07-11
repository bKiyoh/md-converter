import type { MarkdownDocument, SourceLocation } from './markdown'

export type OutputFormat =
  | 'slack'
  | 'backlog-markdown'
  | 'backlog-notation'
  | 'plain-text'

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
