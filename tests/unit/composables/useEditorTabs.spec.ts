import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EDITOR_CONTENT_SAVE_DELAY_MS,
  EDITOR_STATE_STORAGE_KEY,
  LEGACY_MARKDOWN_DRAFT_STORAGE_KEY,
  type EditorStorageAccess,
} from '../../../src/composables/useEditorStorage'
import {
  useEditorTabs,
  type UseEditorTabsResult,
} from '../../../src/composables/useEditorTabs'

type MemoryStorage = EditorStorageAccess & {
  values: Map<string, string>
  getItem: ReturnType<typeof vi.fn<(key: string) => string | null>>
  setItem: ReturnType<typeof vi.fn<(key: string, value: string) => void>>
  removeItem: ReturnType<typeof vi.fn<(key: string) => void>>
}

function createStorage(initial: Record<string, string> = {}): MemoryStorage {
  const values = new Map(Object.entries(initial))

  return {
    values,
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key)
    }),
  }
}

function mountTabs(storage: MemoryStorage): {
  wrapper: VueWrapper
  tabs: UseEditorTabsResult
} {
  let result: UseEditorTabsResult | undefined
  let nextId = 1
  let now = 1_000
  const wrapper = mount(
    defineComponent({
      setup() {
        result = useEditorTabs({
          storage,
          createId: () => `tab-${nextId++}`,
          now: () => now++,
        })
        return {}
      },
      template: '<div />',
    }),
  )

  return { wrapper, tabs: result! }
}

describe('useEditorTabs', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('旧単一文書をUntitledへ移行し、新形式の保存後に旧キーを削除する', () => {
    const storage = createStorage({ [LEGACY_MARKDOWN_DRAFT_STORAGE_KEY]: '# 旧文書' })
    const { tabs } = mountTabs(storage)

    expect(tabs.activeTab.value.name).toBe('Untitled')
    expect(tabs.markdown.value).toBe('# 旧文書')
    expect(storage.values.has(EDITOR_STATE_STORAGE_KEY)).toBe(true)
    expect(storage.removeItem).toHaveBeenCalledWith(LEGACY_MARKDOWN_DRAFT_STORAGE_KEY)
  })

  it('入力内容だけを最後の変更から500ms後に保存する', async () => {
    const storage = createStorage()
    const { tabs } = mountTabs(storage)
    storage.setItem.mockClear()

    tabs.markdown.value = '入力途中'
    await vi.advanceTimersByTimeAsync(EDITOR_CONTENT_SAVE_DELAY_MS - 1)
    expect(storage.setItem).not.toHaveBeenCalled()

    tabs.markdown.value = '保存する内容'
    await vi.advanceTimersByTimeAsync(EDITOR_CONTENT_SAVE_DELAY_MS)

    expect(storage.setItem).toHaveBeenCalledOnce()
    const saved = JSON.parse(storage.values.get(EDITOR_STATE_STORAGE_KEY)!) as {
      tabs: Array<{ content: string }>
    }
    expect(saved.tabs[0]?.content).toBe('保存する内容')
  })

  it('未使用の連番で追加し、7件を上限にする', () => {
    const { tabs } = mountTabs(createStorage())

    for (let index = 0; index < 6; index += 1) {
      tabs.addTab()
    }

    expect(tabs.tabs.value.map((tab) => tab.name)).toEqual([
      'Untitled',
      'Untitled 2',
      'Untitled 3',
      'Untitled 4',
      'Untitled 5',
      'Untitled 6',
      'Untitled 7',
    ])
    expect(tabs.canAddTab.value).toBe(false)
    expect(tabs.addTab()).toBeNull()

    tabs.deleteTab(tabs.tabs.value[2]!.id)
    expect(tabs.addTab()?.name).toBe('Untitled 3')
  })

  it('タブごとの入力を保持して切り替え、同名への変更も許可する', () => {
    const { tabs } = mountTabs(createStorage())
    const firstId = tabs.activeTabId.value
    tabs.markdown.value = '最初の内容'
    const second = tabs.addTab()!
    tabs.markdown.value = '次の内容'

    expect(tabs.renameTab(second.id, '  Untitled  ')).toBe(true)
    expect(tabs.activeTab.value.name).toBe('Untitled')
    expect(tabs.selectTab(firstId)).toBe(true)
    expect(tabs.markdown.value).toBe('最初の内容')
    expect(tabs.selectTab('missing')).toBe(false)
    expect(tabs.renameTab(firstId, '   ')).toBe(false)
    expect(tabs.renameTab(firstId, 'あ'.repeat(31))).toBe(false)
  })

  it('先頭を末尾へ移動しても選択中IDと各タブのデータを維持し、直後に保存する', () => {
    const storage = createStorage()
    const { tabs } = mountTabs(storage)
    const first = tabs.tabs.value[0]!
    tabs.markdown.value = '先頭の本文'
    const second = tabs.addTab()!
    tabs.markdown.value = '選択中の本文'
    const third = tabs.addTab()!
    tabs.markdown.value = '末尾の本文'
    tabs.selectTab(second.id)
    const originalTabs = new Map(tabs.tabs.value.map((tab) => [tab.id, { ...tab }]))
    storage.setItem.mockClear()

    expect(tabs.reorderTab(first.id, third.id, 'after')).toBe(true)

    expect(tabs.tabs.value.map((tab) => tab.id)).toEqual([second.id, third.id, first.id])
    expect(tabs.activeTabId.value).toBe(second.id)
    expect(tabs.markdown.value).toBe('選択中の本文')
    expect(tabs.tabs.value.map((tab) => ({ ...tab }))).toEqual(
      [second.id, third.id, first.id].map((id) => originalTabs.get(id)),
    )
    expect(storage.setItem).toHaveBeenCalledOnce()

    const saved = JSON.parse(storage.values.get(EDITOR_STATE_STORAGE_KEY)!) as {
      tabs: Array<{ id: string }>
      activeTabId: string
    }
    expect(saved.tabs.map((tab) => tab.id)).toEqual([second.id, third.id, first.id])
    expect(saved.activeTabId).toBe(second.id)
  })

  it('末尾を先頭へ移動し、隣接するタブを入れ替えられる', () => {
    const { tabs } = mountTabs(createStorage())
    const first = tabs.tabs.value[0]!
    const second = tabs.addTab()!
    const third = tabs.addTab()!

    expect(tabs.reorderTab(third.id, first.id, 'before')).toBe(true)
    expect(tabs.tabs.value.map((tab) => tab.id)).toEqual([third.id, first.id, second.id])

    expect(tabs.reorderTab(first.id, second.id, 'after')).toBe(true)
    expect(tabs.tabs.value.map((tab) => tab.id)).toEqual([third.id, second.id, first.id])
  })

  it('同じ位置または存在しないIDへの並べ替えでは順序を保存し直さない', () => {
    const storage = createStorage()
    const { tabs } = mountTabs(storage)
    const first = tabs.tabs.value[0]!
    const second = tabs.addTab()!
    const third = tabs.addTab()!
    storage.setItem.mockClear()

    expect(tabs.reorderTab(second.id, third.id, 'before')).toBe(false)
    expect(tabs.reorderTab('missing', first.id, 'before')).toBe(false)
    expect(tabs.reorderTab(first.id, 'missing', 'after')).toBe(false)
    expect(tabs.reorderTab(first.id, first.id, 'after')).toBe(false)
    expect(tabs.tabs.value.map((tab) => tab.id)).toEqual([first.id, second.id, third.id])
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('並べ替えた順序を再読み込み後も復元する', () => {
    const storage = createStorage()
    const firstMount = mountTabs(storage)
    const first = firstMount.tabs.tabs.value[0]!
    const second = firstMount.tabs.addTab()!
    const third = firstMount.tabs.addTab()!

    firstMount.tabs.reorderTab(third.id, first.id, 'before')
    firstMount.wrapper.unmount()

    const secondMount = mountTabs(storage)

    expect(secondMount.tabs.tabs.value.map((tab) => tab.id)).toEqual([
      third.id,
      first.id,
      second.id,
    ])
  })

  it('追加後に並べ替え、削除と復元をしても既存タブと順序を失わない', () => {
    const { tabs } = mountTabs(createStorage())
    const first = tabs.tabs.value[0]!
    tabs.markdown.value = '最初'
    const second = tabs.addTab()!
    tabs.markdown.value = '復元対象'
    const third = tabs.addTab()!
    tabs.markdown.value = '追加したタブ'

    expect(tabs.reorderTab(third.id, first.id, 'before')).toBe(true)
    expect(tabs.tabs.value.map((tab) => tab.id)).toEqual([third.id, first.id, second.id])

    expect(tabs.deleteTab(second.id)?.previousIndex).toBe(2)
    expect(tabs.tabs.value.map((tab) => tab.id)).toEqual([third.id, first.id])
    expect(tabs.restoreTab(second.id)).toBe('restored')
    expect(tabs.tabs.value.map((tab) => tab.id)).toEqual([third.id, first.id, second.id])
    expect(tabs.tabs.value.map((tab) => tab.content)).toEqual([
      '追加したタブ',
      '最初',
      '復元対象',
    ])
  })

  it('選択中タブの削除後は右隣を選び、元の位置へ復元する', () => {
    const { tabs } = mountTabs(createStorage())
    const first = tabs.tabs.value[0]!
    const second = tabs.addTab()!
    const third = tabs.addTab()!
    tabs.selectTab(second.id)
    tabs.markdown.value = '復元する内容'

    const deleted = tabs.deleteTab(second.id)

    expect(deleted?.previousIndex).toBe(1)
    expect(tabs.activeTabId.value).toBe(third.id)
    expect(tabs.restoreTab(second.id)).toBe('restored')
    expect(tabs.tabs.value.map((tab) => tab.id)).toEqual([first.id, second.id, third.id])
    expect(tabs.deletedTabs.value).toHaveLength(0)
  })

  it('デフォルト名の空タブだけを削除済み一覧へ残さず完全削除する', () => {
    const { tabs } = mountTabs(createStorage())
    const emptyDefaultTab = tabs.addTab()!

    tabs.deleteTab(emptyDefaultTab.id)
    expect(tabs.deletedTabs.value).toHaveLength(0)

    const legacyDefaultTab = tabs.addTab()!
    tabs.renameTab(legacyDefaultTab.id, '文章2')
    tabs.deleteTab(legacyDefaultTab.id)
    expect(tabs.deletedTabs.value).toHaveLength(0)

    const renamedEmptyTab = tabs.addTab()!
    tabs.renameTab(renamedEmptyTab.id, 'メモ')
    tabs.deleteTab(renamedEmptyTab.id)
    expect(tabs.deletedTabs.value.map((tab) => tab.id)).toContain(renamedEmptyTab.id)

    const whitespaceTab = tabs.addTab()!
    tabs.markdown.value = ' '
    tabs.deleteTab(whitespaceTab.id)
    expect(tabs.deletedTabs.value.map((tab) => tab.id)).toContain(whitespaceTab.id)
  })

  it('最後のタブは削除せず、7件時は削除済みタブを復元しない', () => {
    const { tabs } = mountTabs(createStorage())
    expect(tabs.deleteTab(tabs.activeTabId.value)).toBeNull()

    for (let index = 0; index < 6; index += 1) {
      tabs.addTab()
    }

    const deletedId = tabs.tabs.value[1]!.id
    tabs.selectTab(deletedId)
    tabs.markdown.value = '復元上限を確認する内容'
    tabs.deleteTab(deletedId)
    tabs.addTab()

    expect(tabs.restoreTab(deletedId)).toBe('limit')
    expect(tabs.deletedTabs.value.some((tab) => tab.id === deletedId)).toBe(true)
    expect(tabs.permanentlyDeleteTab(deletedId)).toBe(true)
    expect(tabs.restoreTab(deletedId)).toBe('not-found')
  })

  it('破棄時に未保存の最新入力を保存する', () => {
    const storage = createStorage()
    const { wrapper, tabs } = mountTabs(storage)
    storage.setItem.mockClear()
    tabs.markdown.value = '破棄直前の内容'

    wrapper.unmount()

    const saved = JSON.parse(storage.values.get(EDITOR_STATE_STORAGE_KEY)!) as {
      tabs: Array<{ content: string }>
    }
    expect(saved.tabs[0]?.content).toBe('破棄直前の内容')
  })

  it('保存待機中にページを離れても最新入力を直ちに保存する', async () => {
    const storage = createStorage()
    const { tabs } = mountTabs(storage)
    storage.setItem.mockClear()
    tabs.markdown.value = 'ページ離脱直前の内容'

    window.dispatchEvent(new Event('pagehide'))

    const saved = JSON.parse(storage.values.get(EDITOR_STATE_STORAGE_KEY)!) as {
      tabs: Array<{ content: string }>
    }
    expect(saved.tabs[0]?.content).toBe('ページ離脱直前の内容')
    expect(storage.setItem).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(EDITOR_CONTENT_SAVE_DELAY_MS)
    expect(storage.setItem).toHaveBeenCalledOnce()
  })

  it('保存待機中にページが非表示になっても最新入力を直ちに保存する', () => {
    const visibilityState = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')
    const storage = createStorage()
    const { tabs } = mountTabs(storage)
    storage.setItem.mockClear()
    tabs.markdown.value = 'バックグラウンド移行直前の内容'

    document.dispatchEvent(new Event('visibilitychange'))

    const saved = JSON.parse(storage.values.get(EDITOR_STATE_STORAGE_KEY)!) as {
      tabs: Array<{ content: string }>
    }
    expect(saved.tabs[0]?.content).toBe('バックグラウンド移行直前の内容')
    expect(storage.setItem).toHaveBeenCalledOnce()

    visibilityState.mockRestore()
  })

  it('破損した保存値をコピー可能な状態で保持し、復旧後に保存を再開する', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const brokenValue = '{"version":1,"tabs":['
    const storage = createStorage({ [EDITOR_STATE_STORAGE_KEY]: brokenValue })
    const { tabs } = mountTabs(storage)

    expect(tabs.storageRecoveryData.value).toBe(brokenValue)
    expect(storage.setItem).not.toHaveBeenCalled()

    tabs.markdown.value = '破損後に入力した内容'
    await vi.advanceTimersByTimeAsync(EDITOR_CONTENT_SAVE_DELAY_MS)

    expect(storage.values.get(EDITOR_STATE_STORAGE_KEY)).toBe(brokenValue)
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(tabs.saveError.value).toBeNull()

    expect(tabs.resumeSavingAfterRecoveryCopy()).toBe(true)
    expect(tabs.storageRecoveryData.value).toBeNull()
    expect(storage.values.get(EDITOR_STATE_STORAGE_KEY)).toContain('破損後に入力した内容')
  })

  it('Storageの読み書きが失敗してもタブ編集を継続する', async () => {
    const storage = createStorage()
    storage.getItem.mockImplementation(() => {
      throw new DOMException('denied')
    })
    storage.setItem.mockImplementation(() => {
      throw new DOMException('quota exceeded')
    })
    const { tabs } = mountTabs(storage)

    tabs.markdown.value = '保存できなくても残る内容'
    const added = tabs.addTab()
    await vi.advanceTimersByTimeAsync(EDITOR_CONTENT_SAVE_DELAY_MS)

    expect(added?.name).toBe('Untitled 2')
    expect(tabs.tabs.value[0]?.content).toBe('保存できなくても残る内容')
    expect(tabs.tabs.value).toHaveLength(2)
    expect(tabs.saveError.value).toContain('ブラウザへの保存に失敗しました')

    storage.setItem.mockImplementation((key: string, value: string) => {
      storage.values.set(key, value)
    })
    expect(tabs.retrySave()).toBe(true)
    expect(tabs.saveError.value).toBeNull()
    expect(storage.values.get(EDITOR_STATE_STORAGE_KEY)).toContain(
      '保存できなくても残る内容',
    )
  })
})
