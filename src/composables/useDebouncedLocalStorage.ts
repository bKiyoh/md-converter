import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

export const STORAGE_SAVE_ERROR_MESSAGE =
  'ブラウザへの保存に失敗しました。編集中の内容をコピーしてから空き容量やブラウザ設定を確認し、保存を再試行してください。'

export type LocalStorageAccess = Pick<Storage, 'getItem' | 'setItem'>

export type UseDebouncedLocalStorageResult<Value> = {
  value: Ref<Value>
  saveError: Ref<string | null>
  retrySave: () => boolean
}

type UseDebouncedLocalStorageOptions<Value> = {
  key: string
  initialValue: Value
  deserialize: (storedValue: string | null) => Value
  serialize: (value: Value) => string
  saveDelayMs: number
  storage?: LocalStorageAccess | null
}

export function getBrowserLocalStorage(): LocalStorageAccess | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function useDebouncedLocalStorage<Value>(
  options: UseDebouncedLocalStorageOptions<Value>,
): UseDebouncedLocalStorageResult<Value> {
  const storage =
    options.storage === undefined ? getBrowserLocalStorage() : options.storage
  const value = ref(options.initialValue) as Ref<Value>
  const saveError = ref<string | null>(null)
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let hasPendingSave = false

  if (storage) {
    try {
      value.value = options.deserialize(storage.getItem(options.key))
    } catch {
      value.value = options.initialValue
    }
  }

  function saveValue(): boolean {
    hasPendingSave = false

    if (!storage) {
      saveError.value = STORAGE_SAVE_ERROR_MESSAGE
      return false
    }

    try {
      storage.setItem(options.key, options.serialize(value.value))
      saveError.value = null
      return true
    } catch {
      saveError.value = STORAGE_SAVE_ERROR_MESSAGE
      return false
    }
  }

  function retrySave(): boolean {
    if (saveTimer !== undefined) {
      clearTimeout(saveTimer)
      saveTimer = undefined
    }

    return saveValue()
  }

  watch(value, () => {
    if (saveTimer !== undefined) {
      clearTimeout(saveTimer)
    }

    hasPendingSave = true

    if (options.saveDelayMs <= 0) {
      saveValue()
      return
    }

    saveTimer = setTimeout(() => {
      saveTimer = undefined
      saveValue()
    }, options.saveDelayMs)
  })

  onBeforeUnmount(() => {
    if (saveTimer !== undefined) {
      clearTimeout(saveTimer)
    }

    if (hasPendingSave) {
      saveValue()
    }
  })

  return { value, saveError, retrySave }
}
