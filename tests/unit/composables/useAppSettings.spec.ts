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
        <input data-testid="scroll-sync" v-model="scrollSync" type="checkbox" />
        <select data-testid="focus-size" v-model.number="focusEditorFontSize">
          <option v-for="size in [8, 10, 12, 14, 16, 18, 20, 22, 24]" :key="size" :value="size">{{ size }}</option>
        </select>
        <output data-testid="save-error">{{ saveError }}</output>
        <button data-testid="retry-save" @click="retrySave">retry</button>
      `,
    }),
  )
}

describe('useAppSettings', () => {
  it.each([8, 10, 12, 14, 16, 18, 20, 22, 24])('文字サイズ%sを保存して復元し、他設定も維持する', async (size) => {
    let saved = JSON.stringify({ editorInternalScroll: false, workspaceSplitRatio: 0.65, scrollSync: false })
    const storage = {
      getItem: vi.fn(() => saved),
      setItem: vi.fn((_key: string, value: string) => { saved = value }),
    }
    const wrapper = mountSettings(storage)
    expect(wrapper.get<HTMLSelectElement>('[data-testid="focus-size"]').element.value).toBe('18')
    await wrapper.get('[data-testid="focus-size"]').setValue(String(size))
    // 標準値の再選択では値が変わらないため、先に別の値へ変更する。
    if (size === 18) {
      await wrapper.get('[data-testid="focus-size"]').setValue('16')
      await wrapper.get('[data-testid="focus-size"]').setValue('18')
    }
    expect(JSON.parse(saved)).toMatchObject({ focusEditorFontSize: size, editorInternalScroll: false, workspaceSplitRatio: 0.65, scrollSync: false })
    wrapper.unmount()
    const reloaded = mountSettings(storage)
    expect(reloaded.get<HTMLSelectElement>('[data-testid="focus-size"]').element.value).toBe(String(size))
    reloaded.unmount()
  })

  it.each([undefined, null, '20', 0, 9, 17, 25, {}, true])('欠損・不正な文字サイズ%jは18へ補完する', (focusEditorFontSize) => {
    const wrapper = mountSettings({
      getItem: () => JSON.stringify({ editorInternalScroll: false, workspaceSplitRatio: 0.65, focusEditorFontSize }),
      setItem: vi.fn(),
    })
    expect(wrapper.get<HTMLSelectElement>('[data-testid="focus-size"]').element.value).toBe('18')
    expect(wrapper.get<HTMLInputElement>('[data-testid="editor-scroll"]').element.checked).toBe(false)
    expect(wrapper.get<HTMLInputElement>('[data-testid="workspace-split-ratio"]').element.value).toBe('0.65')
    wrapper.unmount()
  })

  it('文字サイズの保存失敗でも変更を継続し、再試行で最新値を保存する', async () => {
    const storage = {
      getItem: () => null,
      setItem: vi.fn<(_key: string, _value: string) => void>(() => { throw new DOMException('quota') }),
    }
    const wrapper = mountSettings(storage)
    await wrapper.get('[data-testid="focus-size"]').setValue('24')
    expect(wrapper.get<HTMLSelectElement>('[data-testid="focus-size"]').element.value).toBe('24')
    expect(wrapper.get('[data-testid="save-error"]').text()).not.toBe('')
    storage.setItem.mockImplementation(() => undefined)
    await wrapper.get('[data-testid="retry-save"]').trigger('click')
    expect(JSON.parse(storage.setItem.mock.lastCall![1]).focusEditorFontSize).toBe(24)
    expect(wrapper.get('[data-testid="save-error"]').text()).toBe('')
    wrapper.unmount()
  })

  it.each([undefined, null, 'false', 0])('同期設定が欠損または不正値 %s の場合はONへ補完する', (scrollSync) => {
    const storage = {
      getItem: vi.fn(() => JSON.stringify({ editorInternalScroll: false, workspaceSplitRatio: 0.65, scrollSync })),
      setItem: vi.fn(),
    }
    const wrapper = mountSettings(storage)
    expect(wrapper.get<HTMLInputElement>('[data-testid="scroll-sync"]').element.checked).toBe(true)
    expect(wrapper.get<HTMLInputElement>('[data-testid="editor-scroll"]').element.checked).toBe(false)
    expect(wrapper.get<HTMLInputElement>('[data-testid="workspace-split-ratio"]').element.value).toBe('0.65')
    wrapper.unmount()
  })

  it('同期設定を即時保存・復元し、他の設定を維持する', async () => {
    let storedValue: string | null = null
    const storage = {
      getItem: vi.fn(() => storedValue),
      setItem: vi.fn((_key: string, value: string) => { storedValue = value }),
    }
    const wrapper = mountSettings(storage)
    const checkbox = wrapper.get<HTMLInputElement>('[data-testid="scroll-sync"]')
    expect(checkbox.element.checked).toBe(true)
    await checkbox.setValue(false)
    expect(JSON.parse(storedValue!)).toEqual({
      editorInternalScroll: true, workspaceSplitRatio: 0.5, normalizeFullWidthMarkdown: false, scrollSync: false, focusEditorFontSize: 18,
    })
    wrapper.unmount()
    const reloaded = mountSettings(storage)
    expect(reloaded.get<HTMLInputElement>('[data-testid="scroll-sync"]').element.checked).toBe(false)
    await reloaded.get<HTMLInputElement>('[data-testid="scroll-sync"]').setValue(true)
    expect(JSON.parse(storedValue!).scrollSync).toBe(true)
    reloaded.unmount()
  })

  it('同期設定の保存に失敗しても切り替えを継続し、再試行できる', async () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn<() => void>(() => { throw new DOMException('quota exceeded') }),
    }
    const wrapper = mountSettings(storage)
    await wrapper.get<HTMLInputElement>('[data-testid="scroll-sync"]').setValue(false)
    expect(wrapper.get<HTMLInputElement>('[data-testid="scroll-sync"]').element.checked).toBe(false)
    expect(wrapper.get('[data-testid="save-error"]').text()).not.toBe('')
    storage.setItem.mockImplementation(() => undefined)
    await wrapper.get('[data-testid="retry-save"]').trigger('click')
    expect(wrapper.get('[data-testid="save-error"]').text()).toBe('')
    wrapper.unmount()
  })

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
        scrollSync: true,
        focusEditorFontSize: 18,
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
        scrollSync: true,
        focusEditorFontSize: 18,
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
        scrollSync: true,
        focusEditorFontSize: 18,
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
      setItem: vi.fn<(key: string, value: string) => void>(() => {
        throw new DOMException('quota exceeded')
      }),
    }
    const wrapper = mountSettings(storage)
    const input = wrapper.get<HTMLInputElement>('[data-testid="editor-scroll"]')

    expect(input.element.checked).toBe(true)

    await input.setValue(false)

    expect(input.element.checked).toBe(false)
    expect(storage.setItem).toHaveBeenCalled()
    expect(wrapper.get('[data-testid="save-error"]').text()).toContain(
      'ブラウザへの保存に失敗しました',
    )

    storage.setItem.mockImplementation(() => undefined)
    await wrapper.get('[data-testid="retry-save"]').trigger('click')

    expect(wrapper.get('[data-testid="save-error"]').text()).toBe('')
  })
})
