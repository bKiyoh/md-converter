import type { Ref } from 'vue'
import {
  useDebouncedLocalStorage,
  type LocalStorageAccess,
} from './useDebouncedLocalStorage'

export const MARKDOWN_DRAFT_STORAGE_KEY = 'md-converter:draft:v1'
export const MARKDOWN_DRAFT_SAVE_DELAY_MS = 500

export type DraftStorage = LocalStorageAccess

export type UseMarkdownDraftResult = {
  markdown: Ref<string>
}

export function useMarkdownDraft(
  storage?: DraftStorage | null,
): UseMarkdownDraftResult {
  const markdown = useDebouncedLocalStorage<string>({
    key: MARKDOWN_DRAFT_STORAGE_KEY,
    initialValue: '',
    deserialize: (storedValue) => storedValue ?? '',
    serialize: (value) => value,
    saveDelayMs: MARKDOWN_DRAFT_SAVE_DELAY_MS,
    storage,
  })

  return { markdown }
}
