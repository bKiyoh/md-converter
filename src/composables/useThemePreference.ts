import type { Ref } from 'vue'
import {
  useDebouncedLocalStorage,
  type LocalStorageAccess,
} from './useDebouncedLocalStorage'

export const THEME_PREFERENCE_STORAGE_KEY = 'md-converter:theme:v1'
export const THEME_PREFERENCE_SAVE_DELAY_MS = 500

export type ThemePreference = 'light' | 'dark'

export type UseThemePreferenceResult = {
  theme: Ref<ThemePreference>
  saveError: Ref<string | null>
  retrySave: () => boolean
}

function deserializeTheme(storedValue: string | null): ThemePreference {
  return storedValue === 'dark' ? 'dark' : 'light'
}

export function useThemePreference(
  storage?: LocalStorageAccess | null,
): UseThemePreferenceResult {
  const { value: theme, saveError, retrySave } =
    useDebouncedLocalStorage<ThemePreference>({
    key: THEME_PREFERENCE_STORAGE_KEY,
    initialValue: 'light',
    deserialize: deserializeTheme,
    serialize: (value) => value,
    saveDelayMs: THEME_PREFERENCE_SAVE_DELAY_MS,
    storage,
  })

  return { theme, saveError, retrySave }
}
