import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import {
  APP_SETTINGS_STORAGE_KEY,
  useAppSettings,
  type AppSettings,
} from './useAppSettings'
import type { LocalStorageAccess } from './useDebouncedLocalStorage'

function mountSettings(storage: LocalStorageAccess | null): VueWrapper {
  return mount(
    defineComponent({
      setup() {
        return useAppSettings(storage)
      },
      template: `
        <input
          data-testid="editor-scroll"
          v-model="editorInternalScroll"
          type="checkbox"
        />
      `,
    }),
  )
}

describe('useAppSettings', () => {
  it('保存値がない場合はエディター内部スクロールをONにする', () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    }

    const wrapper = mountSettings(storage)

    expect(wrapper.get<HTMLInputElement>('[data-testid="editor-scroll"]').element.checked).toBe(
      true,
    )
  })

  it('変更をJSONで即時保存し、次回起動時に復元する', async () => {
    let storedValue: string | null = null
    const storage = {
      getItem: vi.fn(() => storedValue),
      setItem: vi.fn((key: string, value: string) => {
        expect(key).toBe(APP_SETTINGS_STORAGE_KEY)
        storedValue = value
      }),
    }
    const wrapper = mountSettings(storage)

    await wrapper.get<HTMLInputElement>('[data-testid="editor-scroll"]').setValue(false)

    expect(storage.setItem).toHaveBeenCalledWith(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify({ editorInternalScroll: false } satisfies AppSettings),
    )

    const reloadedWrapper = mountSettings(storage)
    expect(
      reloadedWrapper.get<HTMLInputElement>('[data-testid="editor-scroll"]').element.checked,
    ).toBe(false)
  })

  it.each([
    ['不正なJSON', '{invalid'],
    ['不正な型', JSON.stringify({ editorInternalScroll: 'yes' })],
    ['必要な値の欠損', JSON.stringify({})],
  ])('%sの場合は初期値へフォールバックする', (_label, storedValue) => {
    const storage = {
      getItem: vi.fn(() => storedValue),
      setItem: vi.fn(),
    }

    const wrapper = mountSettings(storage)

    expect(wrapper.get<HTMLInputElement>('[data-testid="editor-scroll"]').element.checked).toBe(
      true,
    )
  })

  it('LocalStorageの読み書きが失敗しても画面上の設定を変更できる', async () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new DOMException('denied')
      }),
      setItem: vi.fn(() => {
        throw new DOMException('quota exceeded')
      }),
    }
    const wrapper = mountSettings(storage)
    const input = wrapper.get<HTMLInputElement>('[data-testid="editor-scroll"]')

    expect(input.element.checked).toBe(true)

    await input.setValue(false)

    expect(input.element.checked).toBe(false)
    expect(storage.setItem).toHaveBeenCalled()
  })
})
