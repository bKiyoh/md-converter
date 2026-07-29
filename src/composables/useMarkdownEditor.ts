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
import {
  normalizeFullWidthMarkdownInput,
  normalizeInsertedFullWidthMarkdown,
} from '../utils/fullWidthMarkdown'

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
  getFullWidthMarkdownNormalizationEnabled: () => boolean
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
    delimiter?: string,
  ): InputReplacementMatch | null {
    const settings = options.getInputReplacement()
    if (!settings.enabled) {
      return null
    }

    return getActiveReplacementMatch(
      value,
      findDirectInputReplacement(value, caret, settings.rules, delimiter),
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

  function normalizeFullWidthMarkdown(
    result: TextEditResult,
  ): TextEditResult | null {
    if (!options.getFullWidthMarkdownNormalizationEnabled()) {
      return null
    }

    return normalizeFullWidthMarkdownInput(
      result.value,
      result.selectionStart,
      result.selectionEnd,
    )
  }

  function createInsertedTextResult(
    value: string,
    selectionStart: number,
    selectionEnd: number,
    text: string,
  ): TextEditResult {
    const nextCaret = selectionStart + text.length
    return {
      value: value.slice(0, selectionStart) + text + value.slice(selectionEnd),
      selectionStart: nextCaret,
      selectionEnd: nextCaret,
    }
  }

  function normalizeInsertedFullWidthMarkdownResult(
    result: TextEditResult,
    inputStart: number,
    inputEnd: number,
  ): TextEditResult | null {
    if (!options.getFullWidthMarkdownNormalizationEnabled()) {
      return null
    }

    return normalizeInsertedFullWidthMarkdown(
      result.value,
      inputStart,
      inputEnd,
      result.selectionStart,
      result.selectionEnd,
    )
  }

  function applyDirectInputReplacement(
    result: TextEditResult,
    delimiter: string,
  ): TextEditResult | null {
    const delimiterStart = result.selectionEnd - delimiter.length
    const match = findDirectMatch(result.value, delimiterStart, delimiter)
    if (!match) {
      return null
    }

    const replaced = applyInputReplacement(result.value, match)
    const lengthDifference = replaced.value.length - result.value.length
    const nextCaret = result.selectionEnd + lengthDifference
    return {
      ...replaced,
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
      event.data === null
    ) {
      return
    }

    const textarea = event.currentTarget
    if (textarea.selectionStart !== textarea.selectionEnd) {
      return
    }

    const inserted = createInsertedTextResult(
      textarea.value,
      textarea.selectionStart,
      textarea.selectionEnd,
      event.data,
    )
    const normalized = normalizeInsertedFullWidthMarkdownResult(
      inserted,
      textarea.selectionStart,
      textarea.selectionStart + event.data.length,
    )
    const result =
      event.data === ' ' || event.data === '　'
        ? applyDirectInputReplacement(
            normalized ?? inserted,
            event.data,
          ) ?? normalized
        : normalized

    if (!result) {
      return
    }

    event.preventDefault()
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

      const normalized = normalizeInsertedFullWidthMarkdownResult(
        {
          value,
          selectionStart: end,
          selectionEnd: end,
        },
        start,
        end,
      )
      if (normalized) {
        await options.applyTextEdit(textarea, normalized)
        return
      }

      const settings = options.getInputReplacement()
      if (!settings.enabled) {
        return
      }

      if (committedText === ' ' || committedText === '　') {
        const directMatch = getActiveReplacementMatch(
          value,
          findDirectInputReplacement(
            value,
            start,
            settings.rules,
            committedText,
          ),
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
      const initialResult: TextEditResult = {
        value,
        selectionStart,
        selectionEnd,
      }
      const normalized = normalizeFullWidthMarkdown(initialResult)
      let workingResult = normalized ?? initialResult
      const match =
        workingResult.selectionStart === workingResult.selectionEnd
          ? findDirectMatch(
              workingResult.value,
              workingResult.selectionEnd,
              '\n',
            )
          : null

      if (match) {
        workingResult = applyInputReplacement(workingResult.value, match)
      }

      result = continueMarkdownList(
        workingResult.value,
        workingResult.selectionStart,
        workingResult.selectionEnd,
      )

      if (!result && (normalized || match)) {
        result = insertTextAtSelection(workingResult, '\n')
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
