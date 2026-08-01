import { effectScope, ref, type EffectScope } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import {
  useTextSearch,
  type TextSearchEdit,
  type UseTextSearchResult,
} from '../../../src/composables/useTextSearch'

let scope: EffectScope | null = null

afterEach(() => {
  scope?.stop()
  scope = null
})

function createSearch(initialSource: string): {
  source: ReturnType<typeof ref<string>>
  documentKey: ReturnType<typeof ref<string>>
  search: UseTextSearchResult
  edits: TextSearchEdit[]
} {
  const source = ref<string>(initialSource)
  const documentKey = ref<string>('tab-1')
  const edits: TextSearchEdit[] = []
  scope = effectScope()
  const search = scope.run(() =>
    useTextSearch({
      source,
      documentKey,
      applyEdit: async (edit) => {
        edits.push(edit)
        source.value = edit.value
      },
    }),
  )!

  return { source, documentKey, search, edits }
}

describe('useTextSearch', () => {
  it('複数一致を前後へ移動し、先頭と末尾で循環する', () => {
    const { search } = createSearch('one one one')
    search.query.value = 'one'

    expect(search.resultStatus.value).toBe('1 / 3')
    expect(search.currentMatch.value).toEqual({ start: 0, end: 3 })

    search.movePrevious()
    expect(search.resultStatus.value).toBe('3 / 3')
    expect(search.currentMatch.value).toEqual({ start: 8, end: 11 })

    search.moveNext()
    expect(search.resultStatus.value).toBe('1 / 3')
  })

  it('現在の一致だけを置換して次の一致へ移動する', async () => {
    const { source, search, edits } = createSearch('one one one')
    search.query.value = 'one'
    search.replacement.value = 'x'
    search.moveNext()

    await expect(search.replaceCurrent()).resolves.toBe(true)

    expect(source.value).toBe('one x one')
    expect(edits).toEqual([
      {
        value: 'one x one',
        start: 4,
        end: 7,
        replacement: 'x',
      },
    ])
    expect(search.currentMatch.value).toEqual({ start: 6, end: 9 })
    expect(search.resultStatus.value).toBe('2 / 2')
  })

  it('同じ検索語へ置換した場合も現在位置に留まらず次へ進む', async () => {
    const { search } = createSearch('one one')
    search.query.value = 'one'
    search.replacement.value = 'ONE'

    await search.replaceCurrent()

    expect(search.currentMatch.value).toEqual({ start: 4, end: 7 })
    expect(search.resultStatus.value).toBe('2 / 2')
  })

  it('すべて置換を1回の編集として適用して件数を表示する', async () => {
    const { source, search, edits } = createSearch('a A a')
    search.query.value = 'a'
    search.replacement.value = ''

    await expect(search.replaceAll()).resolves.toBe(3)

    expect(source.value).toBe('  ')
    expect(edits).toHaveLength(1)
    expect(edits[0]).toMatchObject({ start: 0, end: 5, replacement: '  ' })
    expect(search.resultStatus.value).toBe('一致なし')
    expect(search.replacementNotice.value).toBe('3件置換しました')
  })

  it('一致がない場合は置換処理を呼ばない', async () => {
    const { source, search, edits } = createSearch('本文')
    search.query.value = 'なし'
    search.replacement.value = '置換'

    await expect(search.replaceCurrent()).resolves.toBe(false)
    await expect(search.replaceAll()).resolves.toBe(0)

    expect(source.value).toBe('本文')
    expect(edits).toEqual([])
  })

  it('本文編集とタブ切り替えで検索結果を再計算する', () => {
    const { source, documentKey, search } = createSearch('hit hit')
    search.query.value = 'hit'
    search.moveNext()
    expect(search.resultStatus.value).toBe('2 / 2')

    source.value = 'hit'
    expect(search.resultStatus.value).toBe('1 / 1')

    source.value = 'hit hit hit'
    documentKey.value = 'tab-2'
    expect(search.resultStatus.value).toBe('1 / 3')
  })
})
