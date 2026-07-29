import { computed, type Ref, type WritableComputedRef } from 'vue'
import {
  useDebouncedLocalStorage,
  type LocalStorageAccess,
} from './useDebouncedLocalStorage'

export const APP_SETTINGS_STORAGE_KEY = 'md-converter:settings:v1'
export const DEFAULT_WORKSPACE_SPLIT_RATIO = 0.5
export const MIN_WORKSPACE_SPLIT_RATIO = 0.2
export const MAX_WORKSPACE_SPLIT_RATIO = 0.8

export type AppSettings = {
  editorInternalScroll: boolean
  workspaceSplitRatio: number
  normalizeFullWidthMarkdown: boolean
}

export type UseAppSettingsResult = {
  settings: Ref<AppSettings>
  editorInternalScroll: WritableComputedRef<boolean>
  workspaceSplitRatio: WritableComputedRef<number>
  normalizeFullWidthMarkdown: WritableComputedRef<boolean>
}

const DEFAULT_APP_SETTINGS: AppSettings = {
  editorInternalScroll: true,
  workspaceSplitRatio: DEFAULT_WORKSPACE_SPLIT_RATIO,
  normalizeFullWidthMarkdown: false,
}

function createDefaultSettings(): AppSettings {
  return { ...DEFAULT_APP_SETTINGS }
}

function deserializeSettings(storedValue: string | null): AppSettings {
  if (storedValue === null) {
    return createDefaultSettings()
  }

  const parsed: unknown = JSON.parse(storedValue)

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('editorInternalScroll' in parsed) ||
    typeof parsed.editorInternalScroll !== 'boolean'
  ) {
    return createDefaultSettings()
  }

  const workspaceSplitRatio =
    'workspaceSplitRatio' in parsed &&
    typeof parsed.workspaceSplitRatio === 'number' &&
    Number.isFinite(parsed.workspaceSplitRatio) &&
    parsed.workspaceSplitRatio >= MIN_WORKSPACE_SPLIT_RATIO &&
    parsed.workspaceSplitRatio <= MAX_WORKSPACE_SPLIT_RATIO
      ? parsed.workspaceSplitRatio
      : DEFAULT_WORKSPACE_SPLIT_RATIO

  const normalizeFullWidthMarkdown =
    'normalizeFullWidthMarkdown' in parsed &&
    typeof parsed.normalizeFullWidthMarkdown === 'boolean'
      ? parsed.normalizeFullWidthMarkdown
      : false

  return {
    editorInternalScroll: parsed.editorInternalScroll,
    workspaceSplitRatio,
    normalizeFullWidthMarkdown,
  }
}

export function useAppSettings(
  storage?: LocalStorageAccess | null,
): UseAppSettingsResult {
  const settings = useDebouncedLocalStorage<AppSettings>({
    key: APP_SETTINGS_STORAGE_KEY,
    initialValue: createDefaultSettings(),
    deserialize: deserializeSettings,
    serialize: (value) => JSON.stringify(value),
    saveDelayMs: 0,
    storage,
  })
  const editorInternalScroll = computed<boolean>({
    get: () => settings.value.editorInternalScroll,
    set: (value) => {
      settings.value = {
        ...settings.value,
        editorInternalScroll: value,
      }
    },
  })
  const workspaceSplitRatio = computed<number>({
    get: () => settings.value.workspaceSplitRatio,
    set: (value) => {
      settings.value = {
        ...settings.value,
        workspaceSplitRatio: value,
      }
    },
  })
  const normalizeFullWidthMarkdown = computed<boolean>({
    get: () => settings.value.normalizeFullWidthMarkdown,
    set: (value) => {
      settings.value = {
        ...settings.value,
        normalizeFullWidthMarkdown: value,
      }
    },
  })

  return {
    settings,
    editorInternalScroll,
    workspaceSplitRatio,
    normalizeFullWidthMarkdown,
  }
}
