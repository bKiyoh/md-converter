import type { Ref } from 'vue'
import {
  INPUT_REPLACEMENT_SETTINGS_VERSION,
  type InputReplacementRule,
  type InputReplacementSettings,
} from '../types/inputReplacement'
import {
  MAX_INPUT_REPLACEMENT_RULES,
  validateInputReplacementDraft,
} from '../utils/inputReplacement'
import {
  useDebouncedLocalStorage,
  type LocalStorageAccess,
} from './useDebouncedLocalStorage'

export const INPUT_REPLACEMENT_STORAGE_KEY =
  'md-converter:input-replacements:v1'

export type UseInputReplacementSettingsOptions = {
  storage?: LocalStorageAccess | null
  createId?: () => string
}

export type UseInputReplacementSettingsResult = {
  settings: Ref<InputReplacementSettings>
  saveError: Ref<string | null>
  retrySave: () => boolean
  addRule: (source: string, replacement: string) => boolean
  updateRule: (id: string, source: string, replacement: string) => boolean
  setRuleEnabled: (id: string, enabled: boolean) => boolean
  deleteRule: (id: string) => boolean
  setEnabled: (enabled: boolean) => void
}

function createInitialSettings(): InputReplacementSettings {
  return {
    version: INPUT_REPLACEMENT_SETTINGS_VERSION,
    enabled: true,
    rules: [],
  }
}

function createBrowserId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `replacement-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function deserializeInputReplacementSettings(
  storedValue: string | null,
): InputReplacementSettings {
  if (storedValue === null) {
    return createInitialSettings()
  }

  const parsed: unknown = JSON.parse(storedValue)

  if (
    !isRecord(parsed) ||
    parsed.version !== INPUT_REPLACEMENT_SETTINGS_VERSION ||
    typeof parsed.enabled !== 'boolean' ||
    !Array.isArray(parsed.rules) ||
    parsed.rules.length > MAX_INPUT_REPLACEMENT_RULES
  ) {
    return createInitialSettings()
  }

  const rules: InputReplacementRule[] = []
  const ids = new Set<string>()

  for (const value of parsed.rules) {
    if (
      !isRecord(value) ||
      typeof value.id !== 'string' ||
      value.id.length === 0 ||
      ids.has(value.id) ||
      typeof value.source !== 'string' ||
      typeof value.replacement !== 'string' ||
      typeof value.enabled !== 'boolean'
    ) {
      return createInitialSettings()
    }

    const validation = validateInputReplacementDraft(
      { source: value.source, replacement: value.replacement },
      rules,
    )

    if (
      Object.keys(validation.errors).length > 0 ||
      validation.source !== value.source
    ) {
      return createInitialSettings()
    }

    ids.add(value.id)
    rules.push({
      id: value.id,
      source: validation.source,
      replacement: validation.replacement,
      enabled: value.enabled,
    })
  }

  return {
    version: INPUT_REPLACEMENT_SETTINGS_VERSION,
    enabled: parsed.enabled,
    rules,
  }
}

export function useInputReplacementSettings(
  options: UseInputReplacementSettingsOptions = {},
): UseInputReplacementSettingsResult {
  const { value: settings, saveError, retrySave } =
    useDebouncedLocalStorage<InputReplacementSettings>({
    key: INPUT_REPLACEMENT_STORAGE_KEY,
    initialValue: createInitialSettings(),
    deserialize: deserializeInputReplacementSettings,
    serialize: (value) => JSON.stringify(value),
    saveDelayMs: 0,
    storage: options.storage,
  })
  const createId = options.createId ?? createBrowserId

  function setEnabled(enabled: boolean): void {
    settings.value = { ...settings.value, enabled }
  }

  function addRule(source: string, replacement: string): boolean {
    if (settings.value.rules.length >= MAX_INPUT_REPLACEMENT_RULES) {
      return false
    }

    const validation = validateInputReplacementDraft(
      { source, replacement },
      settings.value.rules,
    )

    if (Object.keys(validation.errors).length > 0) {
      return false
    }

    const ids = new Set(settings.value.rules.map((rule) => rule.id))
    let id = createId()
    while (ids.has(id)) {
      id = createId()
    }

    settings.value = {
      ...settings.value,
      rules: [
        ...settings.value.rules,
        {
          id,
          source: validation.source,
          replacement: validation.replacement,
          enabled: true,
        },
      ],
    }
    return true
  }

  function updateRule(
    id: string,
    source: string,
    replacement: string,
  ): boolean {
    const index = settings.value.rules.findIndex((rule) => rule.id === id)
    if (index < 0) {
      return false
    }

    const validation = validateInputReplacementDraft(
      { source, replacement },
      settings.value.rules,
      id,
    )
    if (Object.keys(validation.errors).length > 0) {
      return false
    }

    settings.value = {
      ...settings.value,
      rules: settings.value.rules.map((rule) =>
        rule.id === id
          ? {
              ...rule,
              source: validation.source,
              replacement: validation.replacement,
            }
          : rule,
      ),
    }
    return true
  }

  function setRuleEnabled(id: string, enabled: boolean): boolean {
    if (!settings.value.rules.some((rule) => rule.id === id)) {
      return false
    }

    settings.value = {
      ...settings.value,
      rules: settings.value.rules.map((rule) =>
        rule.id === id ? { ...rule, enabled } : rule,
      ),
    }
    return true
  }

  function deleteRule(id: string): boolean {
    const rules = settings.value.rules.filter((rule) => rule.id !== id)
    if (rules.length === settings.value.rules.length) {
      return false
    }

    settings.value = { ...settings.value, rules }
    return true
  }

  return {
    settings,
    saveError,
    retrySave,
    addRule,
    updateRule,
    setRuleEnabled,
    deleteRule,
    setEnabled,
  }
}
