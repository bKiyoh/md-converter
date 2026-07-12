import { computed, type Ref, type WritableComputedRef } from 'vue'
import {
  useDebouncedLocalStorage,
  type LocalStorageAccess,
} from './useDebouncedLocalStorage'

export const APP_SETTINGS_STORAGE_KEY = 'md-converter:settings:v1'

export type AppSettings = {
  editorInternalScroll: boolean
}

export type UseAppSettingsResult = {
  settings: Ref<AppSettings>
  editorInternalScroll: WritableComputedRef<boolean>
}

const DEFAULT_APP_SETTINGS: AppSettings = {
  editorInternalScroll: true,
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

  return {
    editorInternalScroll: parsed.editorInternalScroll,
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

  return { settings, editorInternalScroll }
}
