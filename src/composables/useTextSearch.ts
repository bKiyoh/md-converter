import {
  computed,
  ref,
  watch,
  type ComputedRef,
  type Ref,
} from 'vue'
import {
  findMatchIndexAtOrAfter,
  findTextMatches,
  replaceAllTextMatches,
  replaceTextMatch,
  type TextMatch,
} from '../utils/textSearch'

export type TextSearchEdit = {
  value: string
  start: number
  end: number
  replacement: string
}

export type UseTextSearchOptions = {
  source: Readonly<Ref<string>>
  documentKey: Readonly<Ref<string>>
  applyEdit: (edit: TextSearchEdit) => Promise<void>
}

export type UseTextSearchResult = {
  query: Ref<string>
  replacement: Ref<string>
  matches: ComputedRef<TextMatch[]>
  currentMatch: ComputedRef<TextMatch | null>
  resultStatus: ComputedRef<string>
  replacementNotice: Ref<string>
  moveNext: () => void
  movePrevious: () => void
  replaceCurrent: () => Promise<boolean>
  replaceAll: () => Promise<number>
}

export function useTextSearch(
  options: UseTextSearchOptions,
): UseTextSearchResult {
  const query = ref<string>('')
  const replacement = ref<string>('')
  const currentIndex = ref<number>(-1)
  const replacementNotice = ref<string>('')
  const matches = computed<TextMatch[]>(() =>
    findTextMatches(options.source.value, query.value),
  )
  const currentMatch = computed<TextMatch | null>(
    () => matches.value[currentIndex.value] ?? null,
  )
  const resultStatus = computed<string>(() => {
    if (query.value.length === 0) {
      return '検索語を入力'
    }

    if (matches.value.length === 0 || !currentMatch.value) {
      return '一致なし'
    }

    return `${currentIndex.value + 1} / ${matches.value.length}`
  })

  function resetToFirstMatch(): void {
    currentIndex.value = matches.value.length > 0 ? 0 : -1
  }

  function moveNext(): void {
    const count = matches.value.length

    if (count === 0) {
      currentIndex.value = -1
      return
    }

    currentIndex.value = (currentIndex.value + 1 + count) % count
  }

  function movePrevious(): void {
    const count = matches.value.length

    if (count === 0) {
      currentIndex.value = -1
      return
    }

    currentIndex.value = (currentIndex.value - 1 + count) % count
  }

  async function replaceCurrent(): Promise<boolean> {
    const match = currentMatch.value

    if (!match) {
      return false
    }

    const result = replaceTextMatch(
      options.source.value,
      match,
      replacement.value,
    )

    if (result.count === 0) {
      return false
    }

    await options.applyEdit({
      value: result.value,
      start: match.start,
      end: match.end,
      replacement: replacement.value,
    })

    const updatedMatches = findTextMatches(result.value, query.value)
    currentIndex.value = findMatchIndexAtOrAfter(
      updatedMatches,
      match.start + replacement.value.length,
    )
    replacementNotice.value = '1件置換しました'
    return true
  }

  async function replaceAll(): Promise<number> {
    const source = options.source.value
    const result = replaceAllTextMatches(source, query.value, replacement.value)

    if (result.count === 0) {
      return 0
    }

    await options.applyEdit({
      value: result.value,
      start: 0,
      end: source.length,
      replacement: result.value,
    })

    const updatedMatches = findTextMatches(result.value, query.value)
    currentIndex.value = updatedMatches.length > 0 ? 0 : -1
    replacementNotice.value = `${result.count.toLocaleString('ja-JP')}件置換しました`
    return result.count
  }

  watch(
    query,
    () => {
      replacementNotice.value = ''
      resetToFirstMatch()
    },
    { flush: 'sync' },
  )

  watch(
    replacement,
    () => {
      replacementNotice.value = ''
    },
    { flush: 'sync' },
  )

  watch(
    [options.source, options.documentKey],
    ([nextSource, nextDocumentKey], [previousSource, previousDocumentKey]) => {
      replacementNotice.value = ''

      if (nextDocumentKey !== previousDocumentKey) {
        resetToFirstMatch()
        return
      }

      const previousMatches = findTextMatches(previousSource, query.value)
      const previousOffset = previousMatches[currentIndex.value]?.start ?? 0
      currentIndex.value = findMatchIndexAtOrAfter(
        findTextMatches(nextSource, query.value),
        previousOffset,
      )
    },
    { flush: 'sync' },
  )

  return {
    query,
    replacement,
    matches,
    currentMatch,
    resultStatus,
    replacementNotice,
    moveNext,
    movePrevious,
    replaceCurrent,
    replaceAll,
  }
}
