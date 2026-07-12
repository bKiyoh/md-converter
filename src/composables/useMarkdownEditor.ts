import { nextTick } from 'vue'
import {
  applyMarkdownShortcut,
  changeMarkdownListIndent,
  continueMarkdownList,
  getMarkdownShortcut,
  type TextEditResult,
} from '../utils/markdownEditor'

export type UseMarkdownEditorResult = {
  handleKeydown: (event: KeyboardEvent) => Promise<void>
}

export function useMarkdownEditor(
  updateValue: (value: string) => void,
): UseMarkdownEditorResult {
  async function applyTextEdit(
    textarea: HTMLTextAreaElement,
    result: TextEditResult,
  ): Promise<void> {
    updateValue(result.value)
    await nextTick()
    textarea.focus()
    textarea.setSelectionRange(result.selectionStart, result.selectionEnd)
  }

  async function handleKeydown(event: KeyboardEvent): Promise<void> {
    if (!(event.currentTarget instanceof HTMLTextAreaElement) || event.isComposing) {
      return
    }

    const textarea = event.currentTarget
    const { selectionStart, selectionEnd, value } = textarea
    const shortcut = getMarkdownShortcut(event)
    let result: TextEditResult | null = null

    if (shortcut) {
      result = applyMarkdownShortcut(value, selectionStart, selectionEnd, shortcut)
    } else if (
      event.key === 'Enter' &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey
    ) {
      result = continueMarkdownList(value, selectionStart, selectionEnd)
    } else if (
      event.key === 'Tab' &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      result = changeMarkdownListIndent(
        value,
        selectionStart,
        selectionEnd,
        event.shiftKey ? 'outdent' : 'indent',
      )
    }

    if (!result) {
      return
    }

    event.preventDefault()
    await applyTextEdit(textarea, result)
  }

  return { handleKeydown }
}
