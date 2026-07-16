import { backlogMarkdownConverter } from './backlog-markdown/convertToBacklogMarkdown'
import { backlogNotationConverter } from './backlog-notation/convertToBacklogNotation'
import { plainTextConverter } from './plain-text/convertToPlainText'
import { slackConverter } from './slack/convertToSlack'
import { OUTPUT_FORMATS, type Converter, type OutputFormat } from '../types/conversion'

export type OutputFormatOption = {
  value: OutputFormat
  label: string
}

const outputFormatLabels: Readonly<Record<OutputFormat, string>> = {
  slack: 'Slack',
  'backlog-markdown': 'Backlog Markdown',
  'backlog-notation': 'Backlog記法',
  'plain-text': 'プレーンテキスト',
}

export const outputFormatOptions: readonly OutputFormatOption[] = OUTPUT_FORMATS.map(
  (value) => ({ value, label: outputFormatLabels[value] }),
)

export const converterRegistry: Readonly<Record<OutputFormat, Converter>> = {
  slack: slackConverter,
  'backlog-markdown': backlogMarkdownConverter,
  'backlog-notation': backlogNotationConverter,
  'plain-text': plainTextConverter,
}
