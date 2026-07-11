import { backlogMarkdownConverter } from './backlog-markdown/convertToBacklogMarkdown'
import { backlogNotationConverter } from './backlog-notation/convertToBacklogNotation'
import { plainTextConverter } from './plain-text/convertToPlainText'
import { slackConverter } from './slack/convertToSlack'
import type { Converter, OutputFormat } from '../types/conversion'

export type OutputFormatOption = {
  value: OutputFormat
  label: string
}

export const outputFormatOptions: readonly OutputFormatOption[] = [
  { value: 'slack', label: 'Slack' },
  { value: 'backlog-markdown', label: 'Backlog Markdown' },
  { value: 'backlog-notation', label: 'Backlog記法' },
  { value: 'plain-text', label: 'プレーンテキスト' },
]

export const converterRegistry: Readonly<Record<OutputFormat, Converter>> = {
  slack: slackConverter,
  'backlog-markdown': backlogMarkdownConverter,
  'backlog-notation': backlogNotationConverter,
  'plain-text': plainTextConverter,
}
