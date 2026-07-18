import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EDITOR_STATE_STORAGE_KEY,
  LEGACY_MARKDOWN_DRAFT_STORAGE_KEY,
} from './composables/useEditorStorage'
import { OUTPUT_FORMAT_STORAGE_KEY } from './composables/useOutputFormatPreference'
import { APP_SETTINGS_STORAGE_KEY } from './composables/useAppSettings'
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
    expect(wrapper.get('#markdown-input-count').element.parentElement?.classList).toContain(
      'panel-footer',
    )
    expect(wrapper.get('#conversion-output-count').element.parentElement?.classList).toContain(
      'panel-footer',
    )
    expect(wrapper.get('.warning-summary-button').text()).toBe('⚠ 警告 1件')
    expect(wrapper.find('.warnings').exists()).toBe(false)

    await wrapper.get('.warning-summary-button').trigger('click')

    expect(wrapper.get('.warnings').text()).toContain('見出しレベルを表現できない')
  })

  it('同じ警告をまとめて件数と位置を重ね表示し、Escapeキーで閉じる', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    const input = wrapper.get<HTMLTextAreaElement>('#markdown-input')

    await input.setValue('# 見出し1\n\n## 見出し2')

    const warningButton = wrapper.get<HTMLButtonElement>('.warning-summary-button')
    expect(warningButton.text()).toBe('⚠ 警告 2件')
    expect(warningButton.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.warnings').exists()).toBe(false)

    await warningButton.trigger('click')

    expect(warningButton.attributes('aria-expanded')).toBe('true')
    expect(wrapper.findAll('.warnings li')).toHaveLength(1)
    expect(wrapper.get('.warning-detail').text()).toBe('2件（1:1、3:1）')

    await warningButton.trigger('keydown', { key: 'Escape' })

    expect(wrapper.find('.warnings').exists()).toBe(false)
    expect(document.activeElement).toBe(warningButton.element)
    wrapper.unmount()
  })

  it('警告がない場合は警告ボタンの領域を表示しない', async () => {
    const wrapper = mount(App)

    await wrapper.get<HTMLTextAreaElement>('#markdown-input').setValue('通常の文章')

    expect(wrapper.find('.warning-summary-button').exists()).toBe(false)
    expect(wrapper.find('.warnings-root').exists()).toBe(false)
  })

  it('生HTMLを含んでも他の内容を変換し、具体的な警告を表示する', async () => {
    const wrapper = mount(App)
    const input = wrapper.get<HTMLTextAreaElement>('#markdown-input')

    await input.setValue('前の文章\n\n<div>テスト</div>\n\n後の文章')

    expect(wrapper.get<HTMLTextAreaElement>('#conversion-output').element.value).toBe(
      '前の文章\n\n<div>テスト</div>\n\n後の文章',
    )
    expect(wrapper.get('.warning-summary-button').text()).toBe('⚠ 警告 1件')

    await wrapper.get('.warning-summary-button').trigger('click')

    expect(wrapper.get('.warnings').text()).toContain(
      '生HTMLには対応していないため、文字列として保持しました。',
    )
    expect(wrapper.get('.warnings').text()).toContain('3:1')
    expect(wrapper.get('.warnings').text()).not.toContain('入力内容を確認してください')
  })

  it('4つの変換形式を切り替えられる', async () => {
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
    expect(wrapper.get('#markdown-preview').classes()).toContain(
      'preview-surface--internal-scroll',
    )
    expect(wrapper.find('#conversion-output').exists()).toBe(false)
    expect(wrapper.findAll('.panel-kicker').some((item) => item.text() === 'Preview')).toBe(false)
    expect(input.element.value).toBe('# プレビュー')

    await conversionTab.trigger('click')
    expect(wrapper.get<HTMLTextAreaElement>('#conversion-output').element.value).toBe('*プレビュー*')
    expect(wrapper.findAll('.panel-kicker').some((item) => item.text() === 'Output')).toBe(false)
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
    expect(wrapper.get<HTMLTextAreaElement>('#conversion-output').element.value).toBe('【更新】')
  })

  it('Markdownタブを追加して文書ごとの入力と変換結果を切り替える', async () => {
    const wrapper = mount(App)
    const input = wrapper.get<HTMLTextAreaElement>('#markdown-input')
    const editorPanel = wrapper.get('.editor-panel')

    expect(wrapper.findAll('.document-tab-button')).toHaveLength(1)
    expect(wrapper.get('.document-tab-button').text()).toBe('Untitled')
    expect(wrapper.get('.document-tablist').attributes('role')).toBe('group')
    expect(wrapper.get('.document-tab-button').attributes('role')).toBeUndefined()
    expect(wrapper.get('.document-tab-button').attributes('aria-controls')).toBeUndefined()
    expect(wrapper.get('.document-tab-button').attributes('aria-selected')).toBeUndefined()
    expect(wrapper.get('.document-tab-button').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('.document-tab-button').attributes('tabindex')).toBeUndefined()
    expect(editorPanel.element.firstElementChild?.classList).toContain('document-tabs')
    expect(editorPanel.find('#markdown-input-heading').exists()).toBe(false)
    expect(editorPanel.find('.panel-kicker').exists()).toBe(false)
    expect(wrapper.get('.document-tab-item').classes()).toContain(
      'document-tab-item--active',
    )
    expect(wrapper.get('.document-tab-add-button').element.parentElement?.classList).toContain(
      'document-tablist',
    )
    expect(
      wrapper.get('.document-tab-add-button').element.previousElementSibling?.classList,
    ).toContain('document-tab-item')
    await input.setValue('# 最初')
    await wrapper.get<HTMLButtonElement>('.document-tab-add-button').trigger('click')

    expect(wrapper.findAll('.document-tab-button')).toHaveLength(2)
    expect(wrapper.findAll('.document-tab-button')[1]?.text()).toBe('Untitled 2')
    expect(wrapper.findAll('.document-tab-button')[0]?.attributes('aria-pressed')).toBe('false')
    expect(wrapper.findAll('.document-tab-button')[1]?.attributes('aria-pressed')).toBe('true')
    expect(
      wrapper.get('.document-tab-add-button').element.previousElementSibling,
    ).toBe(wrapper.findAll('.document-tab-item')[1]!.element)
    expect(input.element.value).toBe('')
    await input.setValue('2つ目')
    expect(wrapper.get<HTMLTextAreaElement>('#conversion-output').element.value).toBe('2つ目')

    await wrapper.findAll<HTMLButtonElement>('.document-tab-button')[0]!.trigger('click')
    expect(input.element.value).toBe('# 最初')
    expect(wrapper.get<HTMLTextAreaElement>('#conversion-output').element.value).toBe('*最初*')
    expect(wrapper.findAll('.document-tab-button')[0]?.attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('.document-tab-button')[1]?.attributes('aria-pressed')).toBe('false')
  })

  it('タブ名をダブルクリックで変更し、Escapeでは取り消す', async () => {
    const wrapper = mount(App)
    const tab = wrapper.get<HTMLButtonElement>('.document-tab-button')

    await tab.trigger('dblclick')
    const nameInput = wrapper.get<HTMLInputElement>('.document-tab-name-input')
    await nameInput.setValue('  議事録  ')
    await nameInput.trigger('keydown', { key: 'Enter' })
    expect(wrapper.get('.document-tab-button').text()).toBe('議事録')

    await wrapper.get('.document-tab-button').trigger('dblclick')
    await wrapper.get<HTMLInputElement>('.document-tab-name-input').setValue('変更しない')
    await wrapper.get<HTMLInputElement>('.document-tab-name-input').trigger('keydown', {
      key: 'Escape',
    })
    expect(wrapper.get('.document-tab-button').text()).toBe('議事録')

    const deleteButton = wrapper.get<HTMLButtonElement>('.document-tab-delete-button')
    expect(deleteButton.element.disabled).toBe(true)
    expect(deleteButton.attributes('aria-label')).toBe('議事録を削除')
    expect(deleteButton.find('[data-icon="close"]').exists()).toBe(true)
    expect(wrapper.find('.document-tab-menu').exists()).toBe(false)
  })

  it('デフォルト名の空タブは削除済み一覧へ残さない', async () => {
    const wrapper = mount(App)
    await wrapper.get('.document-tab-add-button').trigger('click')
    await wrapper.findAll<HTMLButtonElement>('.document-tab-delete-button')[1]!.trigger('click')

    expect(wrapper.findAll('.document-tab-button')).toHaveLength(1)
    expect(wrapper.find('.app-notice').exists()).toBe(false)

    await wrapper.get('.deleted-tabs-toggle').trigger('click')
    expect(wrapper.get('.deleted-tabs-empty').text()).toBe('削除済みタブはありません。')
    expect(wrapper.find('.deleted-tab-action--restore').exists()).toBe(false)
  })

  it('内容があるタブは通知を表示せず、削除済み一覧から元の位置へ戻せる', async () => {
    const wrapper = mount(App)
    await wrapper.get('.document-tab-add-button').trigger('click')
    await wrapper.get<HTMLTextAreaElement>('#markdown-input').setValue('復元する内容')
    await wrapper.findAll<HTMLButtonElement>('.document-tab-delete-button')[1]!.trigger('click')

    expect(wrapper.find('.app-notice').exists()).toBe(false)

    await wrapper.get('.deleted-tabs-toggle').trigger('click')
    await wrapper.get<HTMLButtonElement>('.deleted-tab-action--restore').trigger('click')

    expect(wrapper.findAll('.document-tab-button').map((item) => item.text())).toEqual([
      'Untitled',
      'Untitled 2',
    ])
    expect(wrapper.find('.app-notice').exists()).toBe(false)
  })

  it('7件時は追加を無効化し、削除済みタブの復元上限を案内する', async () => {
    const wrapper = mount(App)

    for (let index = 0; index < 6; index += 1) {
      await wrapper.get('.document-tab-add-button').trigger('click')
    }

    const addButton = wrapper.get<HTMLButtonElement>('.document-tab-add-button')
    expect(addButton.element.disabled).toBe(true)
    expect(addButton.attributes('title')).toBe('タブは最大7つまで作成できます')

    await wrapper.findAll<HTMLButtonElement>('.document-tab-button')[1]!.trigger('click')
    await wrapper.get<HTMLTextAreaElement>('#markdown-input').setValue('削除済みに残す内容')
    await wrapper.findAll<HTMLButtonElement>('.document-tab-delete-button')[1]!.trigger('click')
    await addButton.trigger('click')
    const deletedTabsToggle = wrapper.get<HTMLButtonElement>('.deleted-tabs-toggle')
    expect(deletedTabsToggle.attributes('aria-label')).toBe('削除済みタブを表示')
    expect(deletedTabsToggle.find('[data-icon="trash"]').exists()).toBe(true)
    expect(deletedTabsToggle.get('.deleted-tabs-count').text()).toBe('1')

    await deletedTabsToggle.trigger('click')

    const restoreButton = wrapper.get<HTMLButtonElement>('.deleted-tab-action--restore')
    const permanentDeleteButton = wrapper.get<HTMLButtonElement>(
      '.deleted-tab-action--permanent-delete',
    )
    expect(restoreButton.attributes('aria-label')).toBe('Untitled 2を復元')
    expect(restoreButton.attributes('title')).toBe('復元')
    expect(restoreButton.find('[data-icon="rotate-ccw"]').exists()).toBe(true)
    expect(permanentDeleteButton.attributes('aria-label')).toBe('Untitled 2を完全に削除')
    expect(permanentDeleteButton.attributes('title')).toBe('完全に削除')
    expect(permanentDeleteButton.find('[data-icon="trash-x"]').exists()).toBe(true)

    await restoreButton.trigger('click')

    expect(wrapper.get('.app-notice').text()).toContain('タブは最大7つまでです。')
    expect(wrapper.get('.app-notice').text()).toContain(
      '復元するには、現在のタブを1つ削除してください。',
    )
  })

  it('削除済みタブ一覧の外側をクリックすると閉じる', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    const toggle = wrapper.get<HTMLButtonElement>('.deleted-tabs-toggle')

    await toggle.trigger('click')
    await wrapper.get('.deleted-tabs-panel').trigger('click')
    expect(wrapper.find('.deleted-tabs-panel').exists()).toBe(true)

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.deleted-tabs-panel').exists()).toBe(false)
    expect(toggle.attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('空の変換結果ではコピーボタンを無効にする', () => {
    const wrapper = mount(App)
    const copyButton = wrapper.get<HTMLButtonElement>('.copy-button')
    const headerActions = wrapper.get('.app-header-actions')

    expect(copyButton.element.disabled).toBe(true)
    expect(copyButton.attributes('aria-label')).toBe('変換結果をコピー')
    expect(copyButton.attributes('title')).toBe('コピー')
    expect(copyButton.find('[data-icon="copy"]').exists()).toBe(true)
    expect(copyButton.element.parentElement?.classList.contains('header-output-actions')).toBe(true)
    expect(wrapper.get('#output-format').element.parentElement?.parentElement).toBe(
      copyButton.element.parentElement,
    )
    expect(wrapper.find('.theme-button').exists()).toBe(false)
    expect(headerActions.element.firstElementChild?.classList.contains('header-output-actions')).toBe(
      true,
    )
    expect(wrapper.get('label[for="output-format"]').text()).toBe('変換形式')
  })

  it('情報アイコンからタイトルと説明のモーダルを開閉できる', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    const infoButton = wrapper.get<HTMLButtonElement>('.info-button')

    expect(infoButton.attributes('aria-label')).toBe('このアプリについて')
    expect(infoButton.attributes('title')).toBe('このアプリについて')
    expect(infoButton.find('[data-icon="info"]').exists()).toBe(true)
    expect(wrapper.find('.info-modal').exists()).toBe(false)
    expect(wrapper.get('.app-content').attributes()).not.toHaveProperty('inert')

    await infoButton.trigger('click')

    const modal = wrapper.get('.info-modal')
    const closeButton = wrapper.get<HTMLButtonElement>('.modal-close-button')
    expect(modal.attributes('role')).toBe('dialog')
    expect(modal.attributes('aria-modal')).toBe('true')
    expect(wrapper.get('#info-modal-title').text()).toBe('Markdown変換エディタ')
    expect(wrapper.get('#info-modal-description').text()).toBe(
      '貼り付け先に合わせて、ブラウザ内でリアルタイムに変換します。',
    )
    expect(wrapper.get('#info-modal-privacy').text()).toBe(
      '入力内容と設定はこのブラウザのLocalStorageに保存され、外部サーバーには送信されません。ブラウザのサイトデータを削除すると、保存内容も削除されます。',
    )
    expect(modal.attributes('aria-describedby')).toBe(
      'info-modal-description info-modal-privacy',
    )
    expect(wrapper.get('.app-content').attributes()).toHaveProperty('inert')
    expect(document.activeElement).toBe(closeButton.element)

    await modal.trigger('keydown', { key: 'Escape' })

    expect(wrapper.find('.info-modal').exists()).toBe(false)
    expect(document.activeElement).toBe(infoButton.element)
    wrapper.unmount()
  })

  it('設定ボタンでポップオーバーを開き、再押下で閉じる', async () => {
    const wrapper = mount(App)
    const settingsButton = wrapper.get<HTMLButtonElement>('.settings-button')
    const infoButton = wrapper.get<HTMLButtonElement>('.info-button')

    expect(settingsButton.attributes('aria-label')).toBe('設定')
    expect(settingsButton.attributes('title')).toBe('設定')
    expect(settingsButton.attributes('aria-expanded')).toBe('false')
    expect(settingsButton.find('[data-icon="settings"]').exists()).toBe(true)
    expect(infoButton.element.nextElementSibling?.classList).toContain('settings-root')
    expect(wrapper.get('.app-header-actions').find('.settings-button').exists()).toBe(false)

    await settingsButton.trigger('click')

    expect(settingsButton.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('#settings-popover-title').text()).toBe('設定')

    await settingsButton.trigger('click')

    expect(settingsButton.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('#settings-popover').exists()).toBe(false)
  })

  it('設定ポップオーバーを外側クリックとEscキーで閉じる', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    const settingsButton = wrapper.get<HTMLButtonElement>('.settings-button')

    await settingsButton.trigger('click')
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('#settings-popover').exists()).toBe(false)

    await settingsButton.trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('#settings-popover').exists()).toBe(false)
    expect(document.activeElement).toBe(settingsButton.element)
    wrapper.unmount()
  })

  it('設定内のテーマアイコンでポップオーバーを閉じずにテーマを切り替える', async () => {
    const wrapper = mount(App)

    await wrapper.get('.settings-button').trigger('click')
    const themeButton = wrapper.get<HTMLButtonElement>('#dark-mode-setting')
    const editorScrollSwitch = wrapper.get<HTMLInputElement>('#editor-scroll-setting')

    expect(wrapper.get('.setting-name').text()).toBe('テーマ')
    expect(themeButton.attributes('aria-pressed')).toBe('false')
    expect(themeButton.attributes('aria-label')).toBe('ダークモードに切り替える')
    expect(themeButton.attributes('title')).toBe('ダークモードに切り替える')
    expect(themeButton.find('[data-icon="moon"]').exists()).toBe(true)
    expect(editorScrollSwitch.element.checked).toBe(true)

    await themeButton.trigger('click')

    expect(wrapper.get('.app').attributes('data-theme')).toBe('dark')
    expect(wrapper.find('#settings-popover').exists()).toBe(true)
    expect(themeButton.attributes('aria-pressed')).toBe('true')
    expect(themeButton.attributes('aria-label')).toBe('ライトモードに切り替える')
    expect(themeButton.find('[data-icon="sun"]').exists()).toBe(true)

    await vi.advanceTimersByTimeAsync(THEME_PREFERENCE_SAVE_DELAY_MS)
    expect(localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe('dark')

    await themeButton.trigger('click')

    expect(wrapper.get('.app').attributes('data-theme')).toBe('light')
    expect(themeButton.attributes('aria-pressed')).toBe('false')
  })

  it('エディター内部スクロール設定を即時反映・保存・復元する', async () => {
    const wrapper = mount(App)

    expect(wrapper.get('.app').classes()).toContain('app--internal-scroll')
    expect(wrapper.get('#markdown-input').classes()).toContain('text-area--internal-scroll')

    await wrapper.get('.settings-button').trigger('click')
    await wrapper.get<HTMLInputElement>('#editor-scroll-setting').setValue(false)

    expect(wrapper.get('.app').classes()).not.toContain('app--internal-scroll')
    expect(wrapper.get('#markdown-input').classes()).toContain('text-area--expand')
    expect(localStorage.getItem(APP_SETTINGS_STORAGE_KEY)).toBe(
      JSON.stringify({ editorInternalScroll: false }),
    )

    await wrapper.get('#preview-view-tab').trigger('click')
    expect(wrapper.get('#markdown-preview').classes()).toContain('preview-surface--expand')

    wrapper.unmount()
    const reloadedWrapper = mount(App)

    expect(reloadedWrapper.get('.app').classes()).not.toContain('app--internal-scroll')
    expect(reloadedWrapper.get('#markdown-input').classes()).toContain('text-area--expand')
    await reloadedWrapper.get('.settings-button').trigger('click')
    expect(
      reloadedWrapper.get<HTMLInputElement>('#editor-scroll-setting').element.checked,
    ).toBe(false)
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

  it('テーマを手動で切り替えられる', async () => {
    const wrapper = mount(App)
    await wrapper.get('.settings-button').trigger('click')
    const themeButton = wrapper.get<HTMLButtonElement>('#dark-mode-setting')

    expect(wrapper.get('.app').attributes('data-theme')).toBe('light')
    expect(themeButton.attributes('aria-pressed')).toBe('false')
    expect(themeButton.attributes('aria-label')).toBe('ダークモードに切り替える')
    expect(themeButton.attributes('title')).toBe('ダークモードに切り替える')
    expect(themeButton.find('[data-icon="moon"]').exists()).toBe(true)

    await themeButton.trigger('click')

    expect(wrapper.get('.app').attributes('data-theme')).toBe('dark')
    expect(themeButton.attributes('aria-pressed')).toBe('true')
    expect(themeButton.attributes('aria-label')).toBe('ライトモードに切り替える')
    expect(themeButton.find('[data-icon="sun"]').exists()).toBe(true)
  })

  it('ダークモードへの変更を保存して再読み込み時に復元する', async () => {
    const wrapper = mount(App)

    await wrapper.get('.settings-button').trigger('click')
    await wrapper.get<HTMLButtonElement>('#dark-mode-setting').trigger('click')
    await vi.advanceTimersByTimeAsync(THEME_PREFERENCE_SAVE_DELAY_MS)

    expect(localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe('dark')

    const reloadedWrapper = mount(App)
    expect(reloadedWrapper.get('.app').attributes('data-theme')).toBe('dark')
    await reloadedWrapper.get('.settings-button').trigger('click')
    expect(reloadedWrapper.get('#dark-mode-setting').attributes('aria-label')).toBe(
      'ライトモードに切り替える',
    )
  })

  it('ダークモードからライトモードへの変更も保存する', async () => {
    localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'dark')
    const wrapper = mount(App)

    await wrapper.get('.settings-button').trigger('click')
    await wrapper.get<HTMLButtonElement>('#dark-mode-setting').trigger('click')
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
    localStorage.setItem(LEGACY_MARKDOWN_DRAFT_STORAGE_KEY, '# 保存済み')

    const wrapper = mount(App)

    expect(wrapper.get<HTMLTextAreaElement>('#markdown-input').element.value).toBe('# 保存済み')
    expect(wrapper.get<HTMLTextAreaElement>('#conversion-output').element.value).toBe('*保存済み*')
    expect(localStorage.getItem(EDITOR_STATE_STORAGE_KEY)).not.toBeNull()
    expect(localStorage.getItem(LEGACY_MARKDOWN_DRAFT_STORAGE_KEY)).toBeNull()
  })

  it('選択した変換形式を保存し、再読み込み後も同じ形式で変換する', async () => {
    localStorage.setItem(LEGACY_MARKDOWN_DRAFT_STORAGE_KEY, '**重要**')
    const wrapper = mount(App)

    await wrapper.get<HTMLSelectElement>('#output-format').setValue('backlog-notation')

    expect(localStorage.getItem(OUTPUT_FORMAT_STORAGE_KEY)).toBe('backlog-notation')

    const reloadedWrapper = mount(App)

    expect(reloadedWrapper.get<HTMLSelectElement>('#output-format').element.value).toBe(
      'backlog-notation',
    )
    expect(reloadedWrapper.get<HTMLTextAreaElement>('#conversion-output').element.value).toBe(
      "''重要''",
    )
  })

  it('保存された変換形式が不正な場合はSlackを使用する', () => {
    localStorage.setItem(OUTPUT_FORMAT_STORAGE_KEY, 'unknown-format')

    const wrapper = mount(App)

    expect(wrapper.get<HTMLSelectElement>('#output-format').element.value).toBe('slack')
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
    expect(wrapper.get('.copy-button').find('[data-icon="check"]').exists()).toBe(true)
    expect(wrapper.get('.copy-button').attributes('title')).toBe('コピーしました')
    expect(wrapper.get('.app-notice').text()).toBe('Backlog記法形式でコピーしました')
    expect(wrapper.get('.app-notice').attributes('role')).toBe('status')
    expect(wrapper.get('.app-notice').classes()).toContain('toast-notice')

    await vi.advanceTimersByTimeAsync(COPY_NOTICE_DURATION_MS)
    expect(wrapper.find('.app-notice').exists()).toBe(false)
    expect(wrapper.get('.copy-button').find('[data-icon="copy"]').exists()).toBe(true)
    expect(wrapper.get('.copy-button').attributes('title')).toBe('コピー')
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
    expect(wrapper.get('.app-notice').classes()).toContain('toast-notice')
    expect(input.element.value).toBe('失敗しても残る内容')
    expect(wrapper.get<HTMLTextAreaElement>('#conversion-output').element.value).toBe(
      '失敗しても残る内容',
    )
  })
})
