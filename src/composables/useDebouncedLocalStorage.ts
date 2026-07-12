import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

export type LocalStorageAccess = Pick<Storage, 'getItem' | 'setItem'>

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
): Ref<Value> {
  const storage =
    options.storage === undefined ? getBrowserLocalStorage() : options.storage
  const value = ref(options.initialValue) as Ref<Value>
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let hasPendingSave = false

  if (storage) {
    try {
      value.value = options.deserialize(storage.getItem(options.key))
    } catch {
      value.value = options.initialValue
    }
  }

  function saveValue(): void {
    if (storage) {
      try {
        storage.setItem(options.key, options.serialize(value.value))
      } catch {
        // Storageが利用できなくても、画面上の状態と操作は継続させる。
      }
    }

    hasPendingSave = false
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

  return value
}
