import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import {
  INPUT_REPLACEMENT_STORAGE_KEY,
  useInputReplacementSettings,
} from '../../../src/composables/useInputReplacementSettings'
import type { LocalStorageAccess } from '../../../src/composables/useDebouncedLocalStorage'

function mountSettings(
  storage: LocalStorageAccess | null,
  createId = (): string => 'rule-1',
): VueWrapper {
  return mount(
    defineComponent({
      setup() {
        return useInputReplacementSettings({ storage, createId })
      },
      template: `
        <button data-testid="disable" @click="setEnabled(false)">disable</button>
        <button data-testid="add" @click="addRule('あい', 'AI')">add</button>
        <button
          data-testid="update"
          @click="updateRule(settings.rules[0]?.id, 'えーあい', 'AI')"
        >
          update
        </button>
        <button
          data-testid="toggle"
          @click="setRuleEnabled(settings.rules[0]?.id, false)"
        >
          toggle
        </button>
        <button
          data-testid="delete"
          @click="deleteRule(settings.rules[0]?.id)"
        >
          delete
        </button>
        <output data-testid="settings">{{ JSON.stringify(settings) }}</output>
      `,
    }),
  )
}

describe('useInputReplacementSettings', () => {
  it('初期状態を有効・ルールなしにする', () => {
    const wrapper = mountSettings({
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    })

    expect(JSON.parse(wrapper.get('[data-testid="settings"]').text())).toEqual({
      version: 1,
      enabled: true,
      rules: [],
    })
  })

  it('追加・編集・有効切り替え・削除を即時保存する', async () => {
    let storedValue: string | null = null
    const storage = {
      getItem: vi.fn(() => storedValue),
      setItem: vi.fn((key: string, value: string) => {
        expect(key).toBe(INPUT_REPLACEMENT_STORAGE_KEY)
        storedValue = value
      }),
    }
    const wrapper = mountSettings(storage)

    await wrapper.get('[data-testid="add"]').trigger('click')
    expect(JSON.parse(storedValue!)).toMatchObject({
      enabled: true,
      rules: [
        {
          id: 'rule-1',
          source: 'あい',
          replacement: 'AI',
          enabled: true,
        },
      ],
    })

    await wrapper.get('[data-testid="update"]').trigger('click')
    await wrapper.get('[data-testid="toggle"]').trigger('click')
    expect(JSON.parse(storedValue!).rules[0]).toMatchObject({
      source: 'えーあい',
      enabled: false,
    })

    const reloaded = mountSettings(storage)
    expect(JSON.parse(reloaded.get('[data-testid="settings"]').text()).rules).toHaveLength(1)

    await wrapper.get('[data-testid="delete"]').trigger('click')
    expect(JSON.parse(storedValue!).rules).toEqual([])
  })

  it('重複・Markdown記法・101件目を保存しない', async () => {
    const storedRules = Array.from({ length: 100 }, (_, index) => ({
      id: `rule-${index}`,
      source: `word${index}`,
      replacement: `value${index}`,
      enabled: true,
    }))
    const storage = {
      getItem: vi.fn(() =>
        JSON.stringify({ version: 1, enabled: true, rules: storedRules }),
      ),
      setItem: vi.fn(),
    }
    const wrapper = mountSettings(storage)

    await wrapper.get('[data-testid="add"]').trigger('click')
    expect(JSON.parse(wrapper.get('[data-testid="settings"]').text()).rules).toHaveLength(
      100,
    )
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it.each([
    '{invalid',
    JSON.stringify({ version: 2, enabled: true, rules: [] }),
    JSON.stringify({
      version: 1,
      enabled: true,
      rules: [
        { id: '1', source: '#', replacement: '見出し', enabled: true },
      ],
    }),
  ])('不正な保存値では初期状態へ戻る', (storedValue) => {
    const wrapper = mountSettings({
      getItem: vi.fn(() => storedValue),
      setItem: vi.fn(),
    })

    expect(JSON.parse(wrapper.get('[data-testid="settings"]').text())).toEqual({
      version: 1,
      enabled: true,
      rules: [],
    })
  })

  it('LocalStorage例外でも画面上の操作を継続する', async () => {
    const wrapper = mountSettings({
      getItem: vi.fn(() => {
        throw new DOMException('denied')
      }),
      setItem: vi.fn(() => {
        throw new DOMException('quota')
      }),
    })

    await wrapper.get('[data-testid="add"]').trigger('click')
    expect(JSON.parse(wrapper.get('[data-testid="settings"]').text()).rules).toHaveLength(1)
  })
})
