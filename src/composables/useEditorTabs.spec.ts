import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EDITOR_CONTENT_SAVE_DELAY_MS,
  EDITOR_STATE_STORAGE_KEY,
  LEGACY_MARKDOWN_DRAFT_STORAGE_KEY,
  type EditorStorageAccess,
} from './useEditorStorage'
import {
  useEditorTabs,
  type UseEditorTabsResult,
} from './useEditorTabs'

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
  })
})
