import { describe, expect, it, vi } from 'vitest'
import type { EditorState } from '../../../src/types/editorTabs'
import {
  DELETED_TAB_RETENTION_MS,
  EDITOR_STATE_STORAGE_KEY,
  loadEditorState,
  type EditorStorageAccess,
} from '../../../src/composables/useEditorStorage'

function createStorage(value: string | null): EditorStorageAccess {
  return {
    getItem: vi.fn((key: string) => (key === EDITOR_STATE_STORAGE_KEY ? value : null)),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  }
}

function createState(overrides: Partial<EditorState> = {}): EditorState {
  return {
    version: 1,
    tabs: [
      {
        id: 'tab-1',
        name: '文章1',
        content: '# 保存済み',
        createdAt: 100,
        updatedAt: 200,
      },
    ],
    activeTabId: 'tab-1',
    deletedTabs: [],
    ...overrides,
  }
}

describe('loadEditorState', () => {
  it('保存されたタブ状態を復元する', () => {
    const storedState = createState()
    const result = loadEditorState({
      storage: createStorage(JSON.stringify(storedState)),
      now: () => 1_000,
      createId: () => 'new-id',
    })

    expect(result.state).toEqual(storedState)
    expect(result.shouldPersist).toBe(false)
  })

  it('未知または不正な並び順メタデータがあっても保存済みの配列順と全タブを維持する', () => {
    const storedState = {
      ...createState({
        tabs: [
          {
            id: 'tab-2',
            name: '先頭',
            content: '先頭の本文',
            createdAt: 100,
            updatedAt: 200,
          },
          {
            id: 'tab-1',
            name: '末尾',
            content: '末尾の本文',
            createdAt: 100,
            updatedAt: 200,
          },
        ],
        activeTabId: 'tab-1',
      }),
      tabOrder: ['missing-tab'],
    }
    const result = loadEditorState({
      storage: createStorage(JSON.stringify(storedState)),
      now: () => 1_000,
      createId: () => 'new-id',
    })

    expect(result.state.tabs.map((tab) => tab.id)).toEqual(['tab-2', 'tab-1'])
    expect(result.state.tabs.map((tab) => tab.content)).toEqual([
      '先頭の本文',
      '末尾の本文',
    ])
    expect(result.state.activeTabId).toBe('tab-1')
  })

  it('選択中IDだけが存在しない場合は先頭タブを選択して保存し直す', () => {
    const result = loadEditorState({
      storage: createStorage(JSON.stringify(createState({ activeTabId: 'missing' }))),
      now: () => 1_000,
      createId: () => 'new-id',
    })

    expect(result.state.activeTabId).toBe('tab-1')
    expect(result.state.tabs[0]?.content).toBe('# 保存済み')
    expect(result.shouldPersist).toBe(true)
  })

  it('削除後30日以上経過したタブを起動時に除去する', () => {
    const now = DELETED_TAB_RETENTION_MS + 10_000
    const state = createState({
      deletedTabs: [
        {
          id: 'expired',
          name: '期限切れ',
          content: '',
          createdAt: 1,
          updatedAt: 1,
          deletedAt: 10_000,
          previousIndex: 0,
        },
        {
          id: 'retained',
          name: '保持中',
          content: '',
          createdAt: 2,
          updatedAt: 2,
          deletedAt: 10_001,
          previousIndex: 0,
        },
      ],
    })
    const result = loadEditorState({
      storage: createStorage(JSON.stringify(state)),
      now: () => now,
      createId: () => 'new-id',
    })

    expect(result.state.deletedTabs.map((tab) => tab.id)).toEqual(['retained'])
    expect(result.shouldPersist).toBe(true)
  })

  it('破損した保存データでは警告して初期状態へ戻す', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const result = loadEditorState({
      storage: createStorage('{broken'),
      now: () => 500,
      createId: () => 'initial-id',
    })

    expect(result.state.tabs).toEqual([
      {
        id: 'initial-id',
        name: 'Untitled',
        content: '',
        createdAt: 500,
        updatedAt: 500,
      },
    ])
    expect(result.shouldPersist).toBe(false)
    expect(result.recoveryData).toBe('{broken')
    expect(warn).toHaveBeenCalledOnce()
  })
})
