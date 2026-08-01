import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import type { DeletedTab, EditorState, EditorTab } from '../types/editorTabs'
import { STORAGE_SAVE_ERROR_MESSAGE } from './useDebouncedLocalStorage'

export const EDITOR_STATE_STORAGE_KEY = 'markdown-editor-state-v1'
export const LEGACY_MARKDOWN_DRAFT_STORAGE_KEY = 'md-converter:draft:v1'
export const EDITOR_STATE_VERSION = 1
export const EDITOR_CONTENT_SAVE_DELAY_MS = 500
export const DELETED_TAB_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000
export const MAX_EDITOR_TABS = 7
export const MAX_TAB_NAME_LENGTH = 30

export type EditorStorageAccess = Pick<Storage, 'getItem' | 'setItem'> &
  Partial<Pick<Storage, 'removeItem'>>

export type LoadedEditorState = {
  state: EditorState
  shouldPersist: boolean
  shouldRemoveLegacyDraft: boolean
  recoveryData: string | null
}

type LoadEditorStateOptions = {
  storage: EditorStorageAccess | null
  now: () => number
  createId: () => string
}

type UseEditorStorageOptions = {
  storage: EditorStorageAccess | null
  getState: () => EditorState
  removeLegacyDraftAfterSave: boolean
  persistenceBlocked: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasValidTabFields(value: unknown): value is EditorTab {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    value.name === value.name.trim() &&
    Array.from(value.name).length <= MAX_TAB_NAME_LENGTH &&
    typeof value.content === 'string' &&
    typeof value.createdAt === 'number' &&
    Number.isFinite(value.createdAt) &&
    value.createdAt >= 0 &&
    typeof value.updatedAt === 'number' &&
    Number.isFinite(value.updatedAt) &&
    value.updatedAt >= value.createdAt
  )
}

function isValidDeletedTab(value: unknown): value is DeletedTab {
  if (!isRecord(value)) {
    return false
  }

  const { deletedAt, previousIndex } = value

  return (
    hasValidTabFields(value) &&
    typeof deletedAt === 'number' &&
    Number.isFinite(deletedAt) &&
    deletedAt >= value.updatedAt &&
    typeof previousIndex === 'number' &&
    Number.isInteger(previousIndex) &&
    previousIndex >= 0
  )
}

export function isValidEditorState(value: unknown): value is EditorState {
  if (
    !isRecord(value) ||
    value.version !== EDITOR_STATE_VERSION ||
    !Array.isArray(value.tabs) ||
    value.tabs.length < 1 ||
    value.tabs.length > MAX_EDITOR_TABS ||
    !value.tabs.every(hasValidTabFields) ||
    typeof value.activeTabId !== 'string' ||
    !Array.isArray(value.deletedTabs) ||
    !value.deletedTabs.every(isValidDeletedTab)
  ) {
    return false
  }

  const currentIds = value.tabs.map((tab) => tab.id)
  const deletedIds = value.deletedTabs.map((tab) => tab.id)
  const allIds = [...currentIds, ...deletedIds]

  return (
    new Set(allIds).size === allIds.length && currentIds.includes(value.activeTabId)
  )
}

export function createInitialEditorState(
  createId: () => string,
  now: () => number,
  content = '',
): EditorState {
  const timestamp = now()
  const tab: EditorTab = {
    id: createId(),
    name: 'Untitled',
    content,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  return {
    version: EDITOR_STATE_VERSION,
    tabs: [tab],
    activeTabId: tab.id,
    deletedTabs: [],
  }
}

export function loadEditorState(options: LoadEditorStateOptions): LoadedEditorState {
  const fallback = (): LoadedEditorState => ({
    state: createInitialEditorState(options.createId, options.now),
    shouldPersist: true,
    shouldRemoveLegacyDraft: false,
    recoveryData: null,
  })

  if (!options.storage) {
    return fallback()
  }

  let storedValue: string | null

  try {
    storedValue = options.storage.getItem(EDITOR_STATE_STORAGE_KEY)
  } catch {
    return fallback()
  }

  if (storedValue === null) {
    let legacyDraft: string | null = null

    try {
      legacyDraft = options.storage.getItem(LEGACY_MARKDOWN_DRAFT_STORAGE_KEY)
    } catch {
      // 旧データを読めなくても、新しい空のタブで編集を継続する。
    }

    return {
      state: createInitialEditorState(options.createId, options.now, legacyDraft ?? ''),
      shouldPersist: true,
      shouldRemoveLegacyDraft: legacyDraft !== null,
      recoveryData: null,
    }
  }

  try {
    const parsed: unknown = JSON.parse(storedValue)

    if (
      isRecord(parsed) &&
      typeof parsed.activeTabId === 'string' &&
      Array.isArray(parsed.tabs) &&
      parsed.tabs.length > 0 &&
      isRecord(parsed.tabs[0]) &&
      typeof parsed.tabs[0].id === 'string' &&
      !parsed.tabs.some(
        (tab) => isRecord(tab) && tab.id === parsed.activeTabId,
      )
    ) {
      const normalized = { ...parsed, activeTabId: parsed.tabs[0].id }

      if (isValidEditorState(normalized)) {
        const cutoff = options.now() - DELETED_TAB_RETENTION_MS
        const deletedTabs = normalized.deletedTabs.filter((tab) => tab.deletedAt > cutoff)

        return {
          state: { ...normalized, deletedTabs },
          shouldPersist: true,
          shouldRemoveLegacyDraft: false,
          recoveryData: null,
        }
      }
    }

    if (!isValidEditorState(parsed)) {
      throw new Error('Invalid editor state')
    }

    const cutoff = options.now() - DELETED_TAB_RETENTION_MS
    const deletedTabs = parsed.deletedTabs.filter((tab) => tab.deletedAt > cutoff)

    return {
      state: { ...parsed, deletedTabs },
      shouldPersist: deletedTabs.length !== parsed.deletedTabs.length,
      shouldRemoveLegacyDraft: false,
      recoveryData: null,
    }
  } catch {
    console.warn('保存されたタブデータが不正なため、初期状態へ戻しました。')
    return {
      state: createInitialEditorState(options.createId, options.now),
      shouldPersist: false,
      shouldRemoveLegacyDraft: false,
      recoveryData: storedValue,
    }
  }
}

export function getBrowserEditorStorage(): EditorStorageAccess | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function useEditorStorage(options: UseEditorStorageOptions): {
  saveError: Ref<string | null>
  saveImmediately: () => boolean
  resumePersistence: () => boolean
  retrySave: () => boolean
  scheduleSave: () => void
} {
  const saveError = ref<string | null>(null)
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let hasPendingSave = false
  let shouldRemoveLegacyDraft = options.removeLegacyDraftAfterSave
  let persistenceBlocked = options.persistenceBlocked

  function saveState(): boolean {
    if (persistenceBlocked) {
      hasPendingSave = false
      return false
    }

    if (!options.storage) {
      hasPendingSave = false
      saveError.value = STORAGE_SAVE_ERROR_MESSAGE
      return false
    }

    try {
      options.storage.setItem(EDITOR_STATE_STORAGE_KEY, JSON.stringify(options.getState()))

      if (shouldRemoveLegacyDraft) {
        options.storage.removeItem?.(LEGACY_MARKDOWN_DRAFT_STORAGE_KEY)
        shouldRemoveLegacyDraft = false
      }

      hasPendingSave = false
      saveError.value = null
      return true
    } catch {
      hasPendingSave = false
      saveError.value = STORAGE_SAVE_ERROR_MESSAGE
      return false
    }
  }

  function saveImmediately(): boolean {
    if (saveTimer !== undefined) {
      clearTimeout(saveTimer)
      saveTimer = undefined
    }

    return saveState()
  }

  function flushPendingSave(): void {
    if (!hasPendingSave) {
      return
    }

    saveImmediately()
  }

  function handlePageHide(): void {
    flushPendingSave()
  }

  function handleVisibilityChange(): void {
    if (document.visibilityState === 'hidden') {
      flushPendingSave()
    }
  }

  function scheduleSave(): void {
    if (saveTimer !== undefined) {
      clearTimeout(saveTimer)
    }

    hasPendingSave = true
    saveTimer = setTimeout(() => {
      saveTimer = undefined
      saveState()
    }, EDITOR_CONTENT_SAVE_DELAY_MS)
  }

  function resumePersistence(): boolean {
    persistenceBlocked = false
    return saveImmediately()
  }

  onMounted(() => {
    window.addEventListener('pagehide', handlePageHide)
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('pagehide', handlePageHide)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    flushPendingSave()
  })

  return {
    saveError,
    saveImmediately,
    resumePersistence,
    retrySave: saveImmediately,
    scheduleSave,
  }
}
