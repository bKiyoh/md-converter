import { nextTick } from 'vue'
import {
  applyMarkdownShortcut,
  changeMarkdownListIndent,
  continueMarkdownList,
  getMarkdownShortcut,
  type TextEditResult,
} from '../utils/markdownEditor'
import type { InputReplacementRule } from '../types/inputReplacement'
import {
  applyInputReplacement,
  findCompositionInputReplacement,
  findDirectInputReplacement,
  isInsideMarkdownCode,
  type InputReplacementMatch,
} from '../utils/inputReplacement'

export type UseMarkdownEditorResult = {
  handleKeydown: (event: KeyboardEvent) => Promise<void>
  handleBeforeInput: (event: InputEvent) => void
  handleCompositionStart: (event: CompositionEvent) => void
  handleCompositionEnd: (event: CompositionEvent) => void
}

export type UseMarkdownEditorOptions = {
  getInputReplacement: () => {
    enabled: boolean
    rules: readonly InputReplacementRule[]
  }
  applyTextEdit: (
    textarea: HTMLTextAreaElement,
    result: TextEditResult,
  ) => Promise<void>
}

export function useMarkdownEditor(
  options: UseMarkdownEditorOptions,
): UseMarkdownEditorResult {
  let isCompositionActive = false
  let compositionStartValue = ''
  let justEndedComposition = false

  function getActiveReplacementMatch(
    value: string,
    match: InputReplacementMatch | null,
  ): InputReplacementMatch | null {
    const settings = options.getInputReplacement()

    if (
      !settings.enabled ||
      !match ||
      isInsideMarkdownCode(value, match.start, match.end)
    ) {
      return null
    }

    return match
  }

  function findDirectMatch(
    value: string,
    caret: number,
  ): InputReplacementMatch | null {
    const settings = options.getInputReplacement()
    if (!settings.enabled) {
      return null
    }

    return getActiveReplacementMatch(
      value,
      findDirectInputReplacement(value, caret, settings.rules),
    )
  }

  function insertTextAtSelection(
    result: TextEditResult,
    text: string,
  ): TextEditResult {
    const caret = result.selectionEnd
    const nextCaret = caret + text.length
    return {
      value: result.value.slice(0, caret) + text + result.value.slice(caret),
      selectionStart: nextCaret,
      selectionEnd: nextCaret,
    }
  }

  function handleBeforeInput(event: InputEvent): void {
    if (
      !(event.currentTarget instanceof HTMLTextAreaElement) ||
      event.isComposing ||
      isCompositionActive ||
      event.inputType !== 'insertText' ||
      (event.data !== ' ' && event.data !== '　')
    ) {
      return
    }

    const textarea = event.currentTarget
    if (textarea.selectionStart !== textarea.selectionEnd) {
      return
    }

    const match = findDirectMatch(textarea.value, textarea.selectionEnd)
    if (!match) {
      return
    }

    event.preventDefault()
    const result = insertTextAtSelection(
      applyInputReplacement(textarea.value, match),
      event.data,
    )
    void options.applyTextEdit(textarea, result)
  }

  function handleCompositionStart(event: CompositionEvent): void {
    if (!(event.currentTarget instanceof HTMLTextAreaElement)) {
      return
    }

    isCompositionActive = true
    compositionStartValue = event.currentTarget.value
  }

  function handleCompositionEnd(event: CompositionEvent): void {
    if (!(event.currentTarget instanceof HTMLTextAreaElement)) {
      return
    }

    const textarea = event.currentTarget
    const committedText = event.data
    isCompositionActive = false
    justEndedComposition = true
    setTimeout(() => {
      justEndedComposition = false
    }, 0)

    if (!committedText) {
      return
    }

    void nextTick(async () => {
      const value = textarea.value
      if (value === compositionStartValue) {
        return
      }

      const end = textarea.selectionEnd
      const start = end - committedText.length
      if (start < 0 || value.slice(start, end) !== committedText) {
        return
      }

      const settings = options.getInputReplacement()
      if (!settings.enabled) {
        return
      }

      if (committedText === ' ' || committedText === '　') {
        const directMatch = getActiveReplacementMatch(
          value,
          findDirectInputReplacement(value, start, settings.rules),
        )
        if (!directMatch) {
          return
        }

        const result = applyInputReplacement(value, directMatch)
        const delimiterEnd = result.selectionEnd + committedText.length
        await options.applyTextEdit(textarea, {
          ...result,
          selectionStart: delimiterEnd,
          selectionEnd: delimiterEnd,
        })
        return
      }

      const match = getActiveReplacementMatch(
        value,
        findCompositionInputReplacement(value, start, end, settings.rules),
      )
      if (!match) {
        return
      }

      await options.applyTextEdit(textarea, applyInputReplacement(value, match))
    })
  }

  async function handleKeydown(event: KeyboardEvent): Promise<void> {
    if (!(event.currentTarget instanceof HTMLTextAreaElement)) {
      return
    }

    if (
      event.isComposing ||
      isCompositionActive ||
      (event as KeyboardEvent & { keyCode?: number }).keyCode === 229
    ) {
      return
    }

    if (
      event.key === 'Enter' &&
      justEndedComposition &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey
    ) {
      event.preventDefault()
      justEndedComposition = false
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
      const match =
        selectionStart === selectionEnd
          ? findDirectMatch(value, selectionEnd)
          : null

      if (match) {
        const replacementResult = applyInputReplacement(value, match)
        result =
          continueMarkdownList(
            replacementResult.value,
            replacementResult.selectionStart,
            replacementResult.selectionEnd,
          ) ?? insertTextAtSelection(replacementResult, '\n')
      } else {
        result = continueMarkdownList(value, selectionStart, selectionEnd)
      }
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
    await options.applyTextEdit(textarea, result)
  }

  return {
    handleKeydown,
    handleBeforeInput,
    handleCompositionStart,
    handleCompositionEnd,
  }
}
