import { computed, ref, type ComputedRef, type Ref, type WritableComputedRef } from 'vue'
import type { DeletedTab, EditorState, EditorTab } from '../types/editorTabs'
import { countCharacters } from '../utils/countCharacters'
import {
  getBrowserEditorStorage,
  loadEditorState,
  MAX_EDITOR_TABS,
  MAX_TAB_NAME_LENGTH,
  useEditorStorage,
  type EditorStorageAccess,
} from './useEditorStorage'

export type RestoreTabResult = 'restored' | 'limit' | 'not-found'
export type TabDropPosition = 'before' | 'after'

export type UseEditorTabsOptions = {
  storage?: EditorStorageAccess | null
  now?: () => number
  createId?: () => string
}

export type UseEditorTabsResult = {
  tabs: Ref<EditorTab[]>
  deletedTabs: Ref<DeletedTab[]>
  activeTabId: Ref<string>
  activeTab: ComputedRef<EditorTab>
  markdown: WritableComputedRef<string>
  canAddTab: ComputedRef<boolean>
  canDeleteTab: ComputedRef<boolean>
  storageRecoveryData: Ref<string | null>
  resumeSavingAfterRecoveryCopy: () => boolean
  saveError: Ref<string | null>
  retrySave: () => boolean
  addTab: () => EditorTab | null
  selectTab: (id: string) => boolean
  reorderTab: (
    draggedTabId: string,
    targetTabId: string,
    position: TabDropPosition,
  ) => boolean
  renameTab: (id: string, name: string) => boolean
  deleteTab: (id: string) => DeletedTab | null
  restoreTab: (id: string) => RestoreTabResult
  permanentlyDeleteTab: (id: string) => boolean
}

function createBrowserId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function findAvailableTabName(tabs: EditorTab[]): string {
  const usedNumbers = new Set<number>()

  for (const tab of tabs) {
    const number = getDefaultTabNumber(tab.name)

    if (number !== null) {
      usedNumbers.add(number)
    }
  }

  let number = 1

  while (usedNumbers.has(number)) {
    number += 1
  }

  return number === 1 ? 'Untitled' : `Untitled ${number}`
}

function getDefaultTabNumber(name: string): number | null {
  if (name === 'Untitled') {
    return 1
  }

  const match = /^Untitled ([1-9]\d*)$/.exec(name)

  if (!match) {
    return null
  }

  const number = Number(match[1])
  return number >= 2 ? number : null
}

function shouldPermanentlyDeleteImmediately(tab: EditorTab): boolean {
  const isLegacyDefaultName = /^文章[1-9]\d*$/.test(tab.name)
  return tab.content === '' && (getDefaultTabNumber(tab.name) !== null || isLegacyDefaultName)
}

export function reorderTabsById(
  tabs: readonly EditorTab[],
  draggedTabId: string,
  targetTabId: string,
  position: TabDropPosition,
): EditorTab[] | null {
  const draggedIndex = tabs.findIndex((tab) => tab.id === draggedTabId)
  const targetIndex = tabs.findIndex((tab) => tab.id === targetTabId)

  if (draggedIndex < 0 || targetIndex < 0 || draggedTabId === targetTabId) {
    return null
  }

  const reorderedTabs = [...tabs]
  const [draggedTab] = reorderedTabs.splice(draggedIndex, 1)
  const remainingTargetIndex = reorderedTabs.findIndex((tab) => tab.id === targetTabId)
  const insertionIndex = remainingTargetIndex + (position === 'after' ? 1 : 0)

  reorderedTabs.splice(insertionIndex, 0, draggedTab!)

  const orderChanged = reorderedTabs.some((tab, index) => tab.id !== tabs[index]?.id)
  return orderChanged ? reorderedTabs : null
}

export function useEditorTabs(options: UseEditorTabsOptions = {}): UseEditorTabsResult {
  const storage = options.storage === undefined ? getBrowserEditorStorage() : options.storage
  const now = options.now ?? Date.now
  const createId = options.createId ?? createBrowserId
  const loaded = loadEditorState({ storage, now, createId })
  const tabs = ref<EditorTab[]>(loaded.state.tabs)
  const deletedTabs = ref<DeletedTab[]>(loaded.state.deletedTabs)
  const activeTabId = ref<string>(loaded.state.activeTabId)
  const storageRecoveryData = ref<string | null>(loaded.recoveryData)

  function getState(): EditorState {
    return {
      version: 1,
      tabs: tabs.value,
      activeTabId: activeTabId.value,
      deletedTabs: deletedTabs.value,
    }
  }

  const {
    saveError,
    saveImmediately,
    resumePersistence,
    retrySave,
    scheduleSave,
  } = useEditorStorage({
    storage,
    getState,
    removeLegacyDraftAfterSave: loaded.shouldRemoveLegacyDraft,
    persistenceBlocked: loaded.recoveryData !== null,
  })

  if (loaded.shouldPersist) {
    saveImmediately()
  }

  const activeTab = computed<EditorTab>(() => {
    return tabs.value.find((tab) => tab.id === activeTabId.value) ?? tabs.value[0]!
  })
  const markdown = computed<string>({
    get: () => activeTab.value.content,
    set: (content) => {
      const index = tabs.value.findIndex((tab) => tab.id === activeTabId.value)

      if (index < 0) {
        return
      }

      tabs.value[index] = { ...tabs.value[index]!, content, updatedAt: now() }
      scheduleSave()
    },
  })
  const canAddTab = computed<boolean>(() => tabs.value.length < MAX_EDITOR_TABS)
  const canDeleteTab = computed<boolean>(() => tabs.value.length > 1)

  function resumeSavingAfterRecoveryCopy(): boolean {
    if (storageRecoveryData.value === null) {
      return false
    }

    storageRecoveryData.value = null
    return resumePersistence()
  }

  function createUniqueId(): string {
    const usedIds = new Set([
      ...tabs.value.map((tab) => tab.id),
      ...deletedTabs.value.map((tab) => tab.id),
    ])
    let id = createId()

    while (usedIds.has(id)) {
      id = createId()
    }

    return id
  }

  function addTab(): EditorTab | null {
    if (!canAddTab.value) {
      return null
    }

    const timestamp = now()
    const tab: EditorTab = {
      id: createUniqueId(),
      name: findAvailableTabName(tabs.value),
      content: '',
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    tabs.value.push(tab)
    activeTabId.value = tab.id
    saveImmediately()
    return tab
  }

  function selectTab(id: string): boolean {
    if (!tabs.value.some((tab) => tab.id === id)) {
      return false
    }

    activeTabId.value = id
    saveImmediately()
    return true
  }

  function reorderTab(
    draggedTabId: string,
    targetTabId: string,
    position: TabDropPosition,
  ): boolean {
    const reorderedTabs = reorderTabsById(
      tabs.value,
      draggedTabId,
      targetTabId,
      position,
    )

    if (!reorderedTabs) {
      return false
    }

    tabs.value = reorderedTabs
    saveImmediately()
    return true
  }

  function renameTab(id: string, name: string): boolean {
    const trimmedName = name.trim()
    const index = tabs.value.findIndex((tab) => tab.id === id)

    if (
      index < 0 ||
      trimmedName.length === 0 ||
      countCharacters(trimmedName) > MAX_TAB_NAME_LENGTH
    ) {
      return false
    }

    tabs.value[index] = {
      ...tabs.value[index]!,
      name: trimmedName,
      updatedAt: now(),
    }
    saveImmediately()
    return true
  }

  function deleteTab(id: string): DeletedTab | null {
    if (!canDeleteTab.value) {
      return null
    }

    const index = tabs.value.findIndex((tab) => tab.id === id)

    if (index < 0) {
      return null
    }

    const [removed] = tabs.value.splice(index, 1)
    const deletedTab: DeletedTab = {
      ...removed!,
      deletedAt: now(),
      previousIndex: index,
    }
    if (!shouldPermanentlyDeleteImmediately(removed!)) {
      deletedTabs.value.unshift(deletedTab)
    }

    if (activeTabId.value === id) {
      activeTabId.value = tabs.value[index]?.id ?? tabs.value[index - 1]!.id
    }

    saveImmediately()
    return deletedTab
  }

  function restoreTab(id: string): RestoreTabResult {
    const deletedIndex = deletedTabs.value.findIndex((tab) => tab.id === id)

    if (deletedIndex < 0) {
      return 'not-found'
    }

    if (!canAddTab.value) {
      return 'limit'
    }

    const [deletedTab] = deletedTabs.value.splice(deletedIndex, 1)
    const { previousIndex } = deletedTab!
    const tab: EditorTab = {
      id: deletedTab!.id,
      name: deletedTab!.name,
      content: deletedTab!.content,
      createdAt: deletedTab!.createdAt,
      updatedAt: deletedTab!.updatedAt,
    }
    const insertionIndex = Math.min(previousIndex, tabs.value.length)
    tabs.value.splice(insertionIndex, 0, tab)
    saveImmediately()
    return 'restored'
  }

  function permanentlyDeleteTab(id: string): boolean {
    const index = deletedTabs.value.findIndex((tab) => tab.id === id)

    if (index < 0) {
      return false
    }

    deletedTabs.value.splice(index, 1)
    saveImmediately()
    return true
  }

  return {
    tabs,
    deletedTabs,
    activeTabId,
    activeTab,
    markdown,
    canAddTab,
    canDeleteTab,
    storageRecoveryData,
    resumeSavingAfterRecoveryCopy,
    saveError,
    retrySave,
    addTab,
    selectTab,
    reorderTab,
    renameTab,
    deleteTab,
    restoreTab,
    permanentlyDeleteTab,
  }
}
