export const FOCUS_EDITOR_FONT_SIZE_OPTIONS = [
  { value: 8, rem: '0.5rem' },
  { value: 10, rem: '0.625rem' },
  { value: 12, rem: '0.75rem' },
  { value: 14, rem: '0.875rem' },
  { value: 16, rem: '1rem' },
  { value: 18, rem: '1.125rem' },
  { value: 20, rem: '1.25rem' },
  { value: 22, rem: '1.375rem' },
  { value: 24, rem: '1.5rem' },
] as const

export type FocusEditorFontSize = (typeof FOCUS_EDITOR_FONT_SIZE_OPTIONS)[number]['value']
export const DEFAULT_FOCUS_EDITOR_FONT_SIZE: FocusEditorFontSize = 18

export function isFocusEditorFontSize(value: unknown): value is FocusEditorFontSize {
  return FOCUS_EDITOR_FONT_SIZE_OPTIONS.some((option) => option.value === value)
}

export function focusEditorFontSizeRem(value: FocusEditorFontSize): string {
  return FOCUS_EDITOR_FONT_SIZE_OPTIONS.find((option) => option.value === value)!.rem
}
