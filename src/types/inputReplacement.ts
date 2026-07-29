export const INPUT_REPLACEMENT_SETTINGS_VERSION = 1

export type InputReplacementRule = {
  id: string
  source: string
  replacement: string
  enabled: boolean
}

export type InputReplacementSettings = {
  version: typeof INPUT_REPLACEMENT_SETTINGS_VERSION
  enabled: boolean
  rules: InputReplacementRule[]
}

export type InputReplacementDraft = {
  source: string
  replacement: string
}

export type InputReplacementValidationErrors = {
  source?: string
  replacement?: string
  general?: string
}
