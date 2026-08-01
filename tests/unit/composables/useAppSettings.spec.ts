import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import {
  APP_SETTINGS_STORAGE_KEY,
  useAppSettings,
  type AppSettings,
} from '../../../src/composables/useAppSettings'
import type { LocalStorageAccess } from '../../../src/composables/useDebouncedLocalStorage'

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
        <input
          data-testid="workspace-split-ratio"
          v-model.number="workspaceSplitRatio"
          type="range"
          min="0.2"
          max="0.8"
          step="0.05"
        />
        <input
          data-testid="full-width-markdown"
          v-model="normalizeFullWidthMarkdown"
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
    expect(
      wrapper.get<HTMLInputElement>('[data-testid="workspace-split-ratio"]').element.value,
    ).toBe('0.5')
    expect(
      wrapper.get<HTMLInputElement>('[data-testid="full-width-markdown"]').element.checked,
    ).toBe(false)
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
      JSON.stringify({
        editorInternalScroll: false,
        workspaceSplitRatio: 0.5,
        normalizeFullWidthMarkdown: false,
      } satisfies AppSettings),
    )

    const reloadedWrapper = mountSettings(storage)
    expect(
      reloadedWrapper.get<HTMLInputElement>('[data-testid="editor-scroll"]').element.checked,
    ).toBe(false)
    expect(
      reloadedWrapper.get<HTMLInputElement>('[data-testid="workspace-split-ratio"]').element.value,
    ).toBe('0.5')
  })

  it('左右ペイン比率を即時保存して復元する', async () => {
    let storedValue: string | null = null
    const storage = {
      getItem: vi.fn(() => storedValue),
      setItem: vi.fn((_key: string, value: string) => {
        storedValue = value
      }),
    }
    const wrapper = mountSettings(storage)

    await wrapper.get<HTMLInputElement>('[data-testid="workspace-split-ratio"]').setValue('0.65')

    expect(storage.setItem).toHaveBeenLastCalledWith(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        editorInternalScroll: true,
        workspaceSplitRatio: 0.65,
        normalizeFullWidthMarkdown: false,
      } satisfies AppSettings),
    )

    const reloadedWrapper = mountSettings(storage)
    expect(
      reloadedWrapper.get<HTMLInputElement>('[data-testid="workspace-split-ratio"]').element.value,
    ).toBe('0.65')
  })

  it('旧保存値では内部スクロール設定を維持して比率を50%へ補完する', () => {
    const storage = {
      getItem: vi.fn(() => JSON.stringify({ editorInternalScroll: false })),
      setItem: vi.fn(),
    }

    const wrapper = mountSettings(storage)

    expect(wrapper.get<HTMLInputElement>('[data-testid="editor-scroll"]').element.checked).toBe(
      false,
    )
    expect(
      wrapper.get<HTMLInputElement>('[data-testid="workspace-split-ratio"]').element.value,
    ).toBe('0.5')
    expect(
      wrapper.get<HTMLInputElement>('[data-testid="full-width-markdown"]').element.checked,
    ).toBe(false)
  })

  it('全角Markdown補正を即時保存して復元する', async () => {
    let storedValue: string | null = null
    const storage = {
      getItem: vi.fn(() => storedValue),
      setItem: vi.fn((_key: string, value: string) => {
        storedValue = value
      }),
    }
    const wrapper = mountSettings(storage)

    await wrapper.get<HTMLInputElement>('[data-testid="full-width-markdown"]').setValue(true)

    expect(storage.setItem).toHaveBeenLastCalledWith(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        editorInternalScroll: true,
        workspaceSplitRatio: 0.5,
        normalizeFullWidthMarkdown: true,
      } satisfies AppSettings),
    )

    const reloadedWrapper = mountSettings(storage)
    expect(
      reloadedWrapper.get<HTMLInputElement>('[data-testid="full-width-markdown"]').element.checked,
    ).toBe(true)
  })

  it('全角Markdown補正の保存値が不正な場合はOFFへ補完する', () => {
    const storage = {
      getItem: vi.fn(() =>
        JSON.stringify({
          editorInternalScroll: true,
          workspaceSplitRatio: 0.5,
          normalizeFullWidthMarkdown: 'yes',
        }),
      ),
      setItem: vi.fn(),
    }

    const wrapper = mountSettings(storage)

    expect(
      wrapper.get<HTMLInputElement>('[data-testid="full-width-markdown"]').element.checked,
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

  it.each([Number.NaN, 0.1, 0.9])('不正な比率 %s は50%%へフォールバックする', (ratio) => {
    const storage = {
      getItem: vi.fn(() =>
        JSON.stringify({ editorInternalScroll: false, workspaceSplitRatio: ratio }),
      ),
      setItem: vi.fn(),
    }

    const wrapper = mountSettings(storage)

    expect(wrapper.get<HTMLInputElement>('[data-testid="editor-scroll"]').element.checked).toBe(
      false,
    )
    expect(
      wrapper.get<HTMLInputElement>('[data-testid="workspace-split-ratio"]').element.value,
    ).toBe('0.5')
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
