import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MARKDOWN_DRAFT_STORAGE_KEY } from './composables/useMarkdownDraft'
import {
  THEME_PREFERENCE_SAVE_DELAY_MS,
  THEME_PREFERENCE_STORAGE_KEY,
} from './composables/useThemePreference'
import { COPY_NOTICE_DURATION_MS } from './composables/useClipboard'
import App from './App.vue'

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('入力を選択中の形式へリアルタイム変換し、文字数を表示する', async () => {
    const wrapper = mount(App)
    const input = wrapper.get<HTMLTextAreaElement>('#markdown-input')
    const output = wrapper.get<HTMLTextAreaElement>('#conversion-output')

    await input.setValue('# 見出し😀')

    expect(output.element.value).toBe('*見出し😀*')
    expect(wrapper.get('#markdown-input-count').text()).toBe('6文字')
    expect(wrapper.get('#conversion-output-count').text()).toBe('6文字')
    expect(wrapper.get('.warnings').text()).toContain('見出しレベルを表現できない')
  })

  it('4つの出力形式を切り替えられる', async () => {
    const wrapper = mount(App)
    const input = wrapper.get<HTMLInputElement>('#markdown-input')
    const format = wrapper.get<HTMLSelectElement>('#output-format')

    expect(format.findAll('option')).toHaveLength(4)

    await input.setValue('**重要**')
    await format.setValue('backlog-notation')

    expect(wrapper.get<HTMLTextAreaElement>('#conversion-output').element.value).toBe("''重要''")
  })

  it('右ペインの初期表示を変換結果とし、Markdownプレビューへ切り替えられる', async () => {
    const wrapper = mount(App)
    const input = wrapper.get<HTMLTextAreaElement>('#markdown-input')
    const conversionTab = wrapper.get<HTMLButtonElement>('#conversion-view-tab')
    const previewTab = wrapper.get<HTMLButtonElement>('#preview-view-tab')

    expect(conversionTab.attributes('aria-selected')).toBe('true')
    expect(wrapper.find('#conversion-output').exists()).toBe(true)
    expect(wrapper.find('#markdown-preview').exists()).toBe(false)

    await input.setValue('# プレビュー')
    await previewTab.trigger('click')

    expect(previewTab.attributes('aria-selected')).toBe('true')
    expect(wrapper.get('#markdown-preview').html()).toContain('<h1>プレビュー</h1>')
    expect(wrapper.find('#conversion-output').exists()).toBe(false)
    expect(wrapper.find('.copy-button').exists()).toBe(false)
    expect(input.element.value).toBe('# プレビュー')

    await conversionTab.trigger('click')
    expect(wrapper.get<HTMLTextAreaElement>('#conversion-output').element.value).toBe('*プレビュー*')
  })

  it('プレビュー表示中の入力変更を即時反映し、形式選択を維持する', async () => {
    const wrapper = mount(App)
    const input = wrapper.get<HTMLTextAreaElement>('#markdown-input')

    await wrapper.get<HTMLSelectElement>('#output-format').setValue('plain-text')
    await wrapper.get('#preview-view-tab').trigger('click')
    await input.setValue('**更新**')

    expect(wrapper.get('#markdown-preview').html()).toContain('<strong>更新</strong>')

    await wrapper.get('#conversion-view-tab').trigger('click')
    expect(wrapper.get<HTMLSelectElement>('#output-format').element.value).toBe('plain-text')
    expect(wrapper.get<HTMLTextAreaElement>('#conversion-output').element.value).toBe('更新')
  })

  it('空の変換結果ではコピーボタンを無効にする', () => {
    const wrapper = mount(App)

    expect(wrapper.get<HTMLButtonElement>('.copy-button').element.disabled).toBe(true)
  })

  it('入力欄のMarkdownショートカットを適用して選択範囲を復元する', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    const input = wrapper.get<HTMLTextAreaElement>('#markdown-input')

    await input.setValue('hoge')
    input.element.setSelectionRange(0, 4)
    await input.trigger('keydown', { key: 'b', ctrlKey: true })
    await flushPromises()

    expect(input.element.value).toBe('**hoge**')
    expect(input.element.selectionStart).toBe(2)
    expect(input.element.selectionEnd).toBe(6)
    expect(document.activeElement).toBe(input.element)

    await input.trigger('keydown', { key: 'b', metaKey: true })
    await flushPromises()
    expect(input.element.value).toBe('hoge')

    wrapper.unmount()
  })

  it('入力欄でリストを継続し、Tabで階層を変更する', async () => {
    const wrapper = mount(App)
    const input = wrapper.get<HTMLTextAreaElement>('#markdown-input')

    await input.setValue('- 親\n- 子')
    input.element.setSelectionRange(input.element.value.length, input.element.value.length)
    await input.trigger('keydown', { key: 'Tab' })
    await flushPromises()
    expect(input.element.value).toBe('- 親\n  - 子')

    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(input.element.value).toBe('- 親\n  - 子\n  - ')
  })

  it('IME変換中はショートカットを処理せず、通常行のTabを妨げない', async () => {
    const wrapper = mount(App)
    const input = wrapper.get<HTMLTextAreaElement>('#markdown-input')

    await input.setValue('日本語')
    input.element.setSelectionRange(0, 3)
    await input.trigger('keydown', { key: 'b', ctrlKey: true, isComposing: true })
    expect(input.element.value).toBe('日本語')

    const tabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    })
    input.element.dispatchEvent(tabEvent)
    expect(tabEvent.defaultPrevented).toBe(false)
  })

  it('狭い画面向けタブで入力と変換結果を切り替えられる', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    const inputTab = wrapper.get<HTMLButtonElement>('#input-tab')
    const outputTab = wrapper.get<HTMLButtonElement>('#output-tab')

    expect(inputTab.attributes('aria-selected')).toBe('true')
    expect(inputTab.attributes('aria-controls')).toBe('input-panel')
    expect(outputTab.attributes('aria-selected')).toBe('false')
    expect(wrapper.get('.workspace').attributes('data-active-panel')).toBe('input')
    expect(wrapper.get('#input-panel').attributes('role')).toBe('tabpanel')
    expect(wrapper.get('#output-panel').attributes('role')).toBe('tabpanel')

    await outputTab.trigger('click')

    expect(inputTab.attributes('aria-selected')).toBe('false')
    expect(inputTab.attributes('tabindex')).toBe('-1')
    expect(outputTab.attributes('aria-selected')).toBe('true')
    expect(outputTab.attributes('tabindex')).toBe('0')
    expect(wrapper.get('.workspace').attributes('data-active-panel')).toBe('output')

    wrapper.unmount()
  })

  it('狭い画面向けタブを矢印キーとHome・Endキーで操作できる', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    const inputTab = wrapper.get<HTMLButtonElement>('#input-tab')
    const outputTab = wrapper.get<HTMLButtonElement>('#output-tab')

    await inputTab.trigger('keydown', { key: 'ArrowRight' })
    expect(outputTab.attributes('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(outputTab.element)

    await outputTab.trigger('keydown', { key: 'Home' })
    expect(inputTab.attributes('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(inputTab.element)

    await inputTab.trigger('keydown', { key: 'End' })
    expect(outputTab.attributes('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(outputTab.element)

    await outputTab.trigger('keydown', { key: 'ArrowLeft' })
    expect(inputTab.attributes('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(inputTab.element)

    wrapper.unmount()
  })

  it('入力を全削除できる', async () => {
    const wrapper = mount(App)
    const input = wrapper.get<HTMLTextAreaElement>('#markdown-input')

    await input.setValue('削除する内容')
    await wrapper.get('.secondary-button').trigger('click')

    expect(input.element.value).toBe('')
    expect(wrapper.get<HTMLTextAreaElement>('#conversion-output').element.value).toBe('')
  })

  it('テーマを手動で切り替えられる', async () => {
    const wrapper = mount(App)
    const themeButton = wrapper.get<HTMLButtonElement>('.theme-button')

    expect(wrapper.get('.app').attributes('data-theme')).toBe('light')
    expect(themeButton.attributes('aria-pressed')).toBe('false')

    await themeButton.trigger('click')

    expect(wrapper.get('.app').attributes('data-theme')).toBe('dark')
    expect(themeButton.attributes('aria-pressed')).toBe('true')
  })

  it('ダークモードへの変更を保存して再読み込み時に復元する', async () => {
    const wrapper = mount(App)

    await wrapper.get<HTMLButtonElement>('.theme-button').trigger('click')
    await vi.advanceTimersByTimeAsync(THEME_PREFERENCE_SAVE_DELAY_MS)

    expect(localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe('dark')

    const reloadedWrapper = mount(App)
    expect(reloadedWrapper.get('.app').attributes('data-theme')).toBe('dark')
    expect(reloadedWrapper.get('.theme-button').text()).toBe('ライトモード')
  })

  it('ダークモードからライトモードへの変更も保存する', async () => {
    localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'dark')
    const wrapper = mount(App)

    await wrapper.get<HTMLButtonElement>('.theme-button').trigger('click')
    await vi.advanceTimersByTimeAsync(THEME_PREFERENCE_SAVE_DELAY_MS)

    expect(wrapper.get('.app').attributes('data-theme')).toBe('light')
    expect(localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe('light')
  })

  it('保存されたテーマが不正な場合はライトモードを使用する', () => {
    localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'sepia')

    const wrapper = mount(App)

    expect(wrapper.get('.app').attributes('data-theme')).toBe('light')
  })

  it('LocalStorageに保存したMarkdown入力を復元する', () => {
    localStorage.setItem(MARKDOWN_DRAFT_STORAGE_KEY, '# 保存済み')

    const wrapper = mount(App)

    expect(wrapper.get<HTMLTextAreaElement>('#markdown-input').element.value).toBe('# 保存済み')
    expect(wrapper.get<HTMLTextAreaElement>('#conversion-output').element.value).toBe('*保存済み*')
  })

  it('選択中の形式名を含むメッセージを表示して変換結果をコピーする', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const wrapper = mount(App)

    await wrapper.get<HTMLTextAreaElement>('#markdown-input').setValue('**重要**')
    await wrapper.get<HTMLSelectElement>('#output-format').setValue('backlog-notation')
    await wrapper.get<HTMLButtonElement>('.copy-button').trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith("''重要''")
    expect(wrapper.get('.app-notice').text()).toBe('Backlog記法形式でコピーしました')
    expect(wrapper.get('.app-notice').attributes('role')).toBe('status')

    await vi.advanceTimersByTimeAsync(COPY_NOTICE_DURATION_MS)
    expect(wrapper.find('.app-notice').exists()).toBe(false)
  })

  it('コピー失敗時に手動コピーを案内し、入力と変換結果を維持する', async () => {
    const writeText = vi.fn(() => Promise.reject(new DOMException('denied')))
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const wrapper = mount(App)
    const input = wrapper.get<HTMLTextAreaElement>('#markdown-input')

    await input.setValue('失敗しても残る内容')
    await wrapper.get<HTMLButtonElement>('.copy-button').trigger('click')
    await flushPromises()

    expect(wrapper.get('.app-notice').text()).toBe(
      'コピーに失敗しました。変換結果を選択して手動でコピーしてください。',
    )
    expect(wrapper.get('.app-notice').attributes('role')).toBe('alert')
    expect(input.element.value).toBe('失敗しても残る内容')
    expect(wrapper.get<HTMLTextAreaElement>('#conversion-output').element.value).toBe(
      '失敗しても残る内容',
    )
  })
})
