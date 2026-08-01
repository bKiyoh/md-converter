import type { Ref } from 'vue'
import { isOutputFormat, type OutputFormat } from '../types/conversion'
import {
  useDebouncedLocalStorage,
  type LocalStorageAccess,
} from './useDebouncedLocalStorage'

export const OUTPUT_FORMAT_STORAGE_KEY = 'md-converter:output-format:v1'
export const DEFAULT_OUTPUT_FORMAT: OutputFormat = 'backlog-notation'

export type OutputFormatStorage = LocalStorageAccess

export type UseOutputFormatPreferenceResult = {
  selectedFormat: Ref<OutputFormat>
  saveError: Ref<string | null>
  retrySave: () => boolean
}

function deserializeOutputFormat(storedValue: string | null): OutputFormat {
  return isOutputFormat(storedValue) ? storedValue : DEFAULT_OUTPUT_FORMAT
}

export function useOutputFormatPreference(
  storage?: OutputFormatStorage | null,
): UseOutputFormatPreferenceResult {
  const { value: selectedFormat, saveError, retrySave } =
    useDebouncedLocalStorage<OutputFormat>({
    key: OUTPUT_FORMAT_STORAGE_KEY,
    initialValue: DEFAULT_OUTPUT_FORMAT,
    deserialize: deserializeOutputFormat,
    serialize: (value) => value,
    saveDelayMs: 0,
    storage,
  })

  return { selectedFormat, saveError, retrySave }
}
