import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EDITOR_CONTENT_SAVE_DELAY_MS,
  EDITOR_STATE_STORAGE_KEY,
  LEGACY_MARKDOWN_DRAFT_STORAGE_KEY,
} from '../../src/composables/useEditorStorage'
import { OUTPUT_FORMAT_STORAGE_KEY } from '../../src/composables/useOutputFormatPreference'
import { APP_SETTINGS_STORAGE_KEY } from '../../src/composables/useAppSettings'
import { INPUT_REPLACEMENT_STORAGE_KEY } from '../../src/composables/useInputReplacementSettings'
import {
  THEME_PREFERENCE_SAVE_DELAY_MS,
  THEME_PREFERENCE_STORAGE_KEY,
} from '../../src/composables/useThemePreference'
import { COPY_NOTICE_DURATION_MS } from '../../src/composables/useClipboard'
import App from '../../src/App.vue'

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

    expect(input.element.tagName).toBe('TEXTAREA')
    expect(output.attributes('readonly')).toBeDefined()

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
      'document-tab-add-tooltip-target',
    )
    expect(
      wrapper.get('.document-tab-add-tooltip-target').element.previousElementSibling?.classList,
    ).toContain('document-tab-item')
    await input.setValue('# 最初')
    await wrapper.get<HTMLButtonElement>('.document-tab-add-button').trigger('click')

    expect(wrapper.findAll('.document-tab-button')).toHaveLength(2)
    expect(wrapper.findAll('.document-tab-button')[1]?.text()).toBe('Untitled 2')
    expect(wrapper.findAll('.document-tab-button')[0]?.attributes('aria-pressed')).toBe('false')
    expect(wrapper.findAll('.document-tab-button')[1]?.attributes('aria-pressed')).toBe('true')
    expect(
      wrapper.get('.document-tab-add-tooltip-target').element.previousElementSibling,
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

  it('タブ切り替えで検索結果を再計算し、選択中タブだけを一括置換する', async () => {
    const wrapper = mount(App)
    const input = wrapper.get<HTMLTextAreaElement>('#markdown-input')

    await input.setValue('hit hit')
    await wrapper.get('.editor-search-button').trigger('click')
    await wrapper.get<HTMLInputElement>('#markdown-search-input').setValue('hit')
    expect(wrapper.get('.search-result-status').text()).toBe('1 / 2')

    await wrapper.get('.document-tab-add-button').trigger('click')
    expect(wrapper.get<HTMLInputElement>('#markdown-search-input').element.value).toBe('hit')
    expect(wrapper.get('.search-result-status').text()).toBe('一致なし')

    await input.setValue('hit hit hit')
    expect(wrapper.get('.search-result-status').text()).toBe('1 / 3')
    await wrapper.get('.search-replace-toggle').trigger('click')
    await wrapper.get<HTMLInputElement>('#markdown-replacement-input').setValue('done')
    await wrapper.findAll('.search-action-button')[1]!.trigger('click')
    await flushPromises()

    expect(input.element.value).toBe('done done done')
    expect(wrapper.get('.replacement-notice').text()).toBe('3件置換しました')

    await vi.advanceTimersByTimeAsync(EDITOR_CONTENT_SAVE_DELAY_MS)
    const saved = JSON.parse(localStorage.getItem(EDITOR_STATE_STORAGE_KEY)!) as {
      tabs: Array<{ content: string }>
    }
    expect(saved.tabs.map((tab) => tab.content)).toEqual(['hit hit', 'done done done'])

    await wrapper.findAll<HTMLButtonElement>('.document-tab-button')[0]!.trigger('click')

    expect(input.element.value).toBe('hit hit')
    expect(wrapper.get('.search-result-status').text()).toBe('1 / 2')
    expect(wrapper.get<HTMLInputElement>('#markdown-search-input').element.value).toBe('hit')
  })

  it('タブを並べ替えても選択と本文の対応を維持し、再読み込み後も順序を復元する', async () => {
    let wrapper = mount(App)
    const input = wrapper.get<HTMLTextAreaElement>('#markdown-input')

    await input.setValue('先頭の本文')
    await wrapper.get('.document-tab-add-button').trigger('click')
    await input.setValue('中央の本文')
    await wrapper.get('.document-tab-add-button').trigger('click')
    await input.setValue('末尾の本文')
    await wrapper.findAll<HTMLButtonElement>('.document-tab-button')[1]!.trigger('click')

    const items = wrapper.findAll<HTMLElement>('.document-tab-item')
    const firstButton = wrapper.findAll<HTMLButtonElement>('.document-tab-button')[0]!
    const dataTransfer = {
      effectAllowed: 'none',
      dropEffect: 'none',
      setData: vi.fn(),
    } as unknown as DataTransfer

    vi.spyOn(items[2]!.element, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      right: 200,
      top: 0,
      bottom: 40,
      width: 100,
      height: 40,
      x: 100,
      y: 0,
      toJSON: () => ({}),
    })

    await firstButton.trigger('dragstart', { dataTransfer })
    await items[2]!.trigger('dragover', { clientX: 190, dataTransfer })
    await items[2]!.trigger('drop', { clientX: 190, dataTransfer })
    await firstButton.trigger('dragend', { dataTransfer })

    expect(wrapper.findAll('.document-tab-button').map((tab) => tab.text())).toEqual([
      'Untitled 2',
      'Untitled 3',
      'Untitled',
    ])
    expect(input.element.value).toBe('中央の本文')
    expect(wrapper.findAll('.document-tab-button')[0]?.attributes('aria-pressed')).toBe('true')

    const saved = JSON.parse(localStorage.getItem(EDITOR_STATE_STORAGE_KEY)!) as {
      tabs: Array<{ id: string; name: string; content: string }>
      activeTabId: string
    }
    expect(saved.tabs.map((tab) => [tab.name, tab.content])).toEqual([
      ['Untitled 2', '中央の本文'],
      ['Untitled 3', '末尾の本文'],
      ['Untitled', '先頭の本文'],
    ])
    expect(saved.activeTabId).toBe(saved.tabs[0]?.id)

    wrapper.unmount()
    wrapper = mount(App)

    expect(wrapper.findAll('.document-tab-button').map((tab) => tab.text())).toEqual([
      'Untitled 2',
      'Untitled 3',
      'Untitled',
    ])
    expect(wrapper.get<HTMLTextAreaElement>('#markdown-input').element.value).toBe('中央の本文')
    wrapper.unmount()
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
    expect(addButton.attributes('title')).toBeUndefined()
    expect(addButton.element.parentElement?.dataset.tooltip).toBe(
      'タブは最大7つまで作成できます',
    )

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
    expect(restoreButton.attributes('data-tooltip')).toBe('復元')
    expect(restoreButton.find('[data-icon="rotate-ccw"]').exists()).toBe(true)
    expect(permanentDeleteButton.attributes('aria-label')).toBe('Untitled 2を完全に削除')
    expect(permanentDeleteButton.attributes('data-tooltip')).toBe('完全に削除')
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

  it('削除済みタブを復元または完全削除しても一覧を閉じない', async () => {
    const wrapper = mount(App, { attachTo: document.body })

    await wrapper.get('.document-tab-add-button').trigger('click')
    await wrapper.get<HTMLTextAreaElement>('#markdown-input').setValue('復元する内容')
    await wrapper.get('.document-tab-add-button').trigger('click')
    await wrapper.get<HTMLTextAreaElement>('#markdown-input').setValue('完全削除する内容')
    await wrapper.findAll<HTMLButtonElement>('.document-tab-delete-button')[2]!.trigger('click')
    await wrapper.findAll<HTMLButtonElement>('.document-tab-delete-button')[1]!.trigger('click')
    await wrapper.get<HTMLButtonElement>('.deleted-tabs-toggle').trigger('click')

    await wrapper
      .findAll<HTMLButtonElement>('.deleted-tab-action--restore')[0]!
      .trigger('click')

    expect(wrapper.find('.deleted-tabs-panel').exists()).toBe(true)
    expect(wrapper.get<HTMLButtonElement>('.deleted-tabs-toggle').attributes('aria-expanded')).toBe(
      'true',
    )

    await wrapper
      .get<HTMLButtonElement>('.deleted-tab-action--permanent-delete')
      .trigger('click')

    expect(wrapper.find('.deleted-tabs-panel').exists()).toBe(true)
    expect(wrapper.get('.deleted-tabs-empty').text()).toBe('削除済みタブはありません。')
    expect(wrapper.get<HTMLButtonElement>('.deleted-tabs-toggle').attributes('aria-expanded')).toBe(
      'true',
    )
    wrapper.unmount()
  })

  it('空の変換結果ではコピーボタンを無効にする', async () => {
    const wrapper = mount(App)
    const copyButton = wrapper.get<HTMLButtonElement>('.copy-button')
    const headerActions = wrapper.get('.app-header-actions')

    expect(copyButton.element.disabled).toBe(true)
    expect(copyButton.attributes('aria-label')).toBe('変換結果をコピー')
    expect(copyButton.attributes('title')).toBeUndefined()
    expect(copyButton.element.parentElement?.dataset.tooltip).toBe('コピー')
    expect(copyButton.find('[data-icon="copy"]').exists()).toBe(true)
    expect(copyButton.element.parentElement?.classList.contains('copy-tooltip-target')).toBe(true)
    expect(copyButton.element.closest('.header-output-actions')).toBe(
      wrapper.get('#output-format').element.closest('.header-output-actions'),
    )
    expect(wrapper.get('.settings-root').element.nextElementSibling).toBe(
      wrapper.get('.format-field').element,
    )
    expect(wrapper.get('.format-field').element.nextElementSibling).toBe(
      wrapper.get('.copy-tooltip-target').element,
    )
    expect(wrapper.find('.theme-button').exists()).toBe(false)
    expect(headerActions.element.firstElementChild?.classList.contains('header-output-actions')).toBe(
      true,
    )
    const formatPrefix = wrapper.get<HTMLButtonElement>('.format-field-prefix')
    const formatLabel = wrapper.get('label.visually-hidden[for="output-format"]')
    const formatSelect = wrapper.get<HTMLSelectElement>('#output-format')
    const showPicker = vi.fn()
    Object.defineProperty(formatSelect.element, 'showPicker', {
      configurable: true,
      value: showPicker,
    })

    expect(formatPrefix.attributes('aria-label')).toBe('変換先')
    expect(formatPrefix.attributes('title')).toBeUndefined()
    expect(formatSelect.attributes('title')).toBeUndefined()
    expect(wrapper.get('.format-field').attributes('data-tooltip')).toBe('変換先')
    expect(formatPrefix.find('[data-icon="file-output"]').exists()).toBe(true)
    expect(formatLabel.text()).toBe('変換先')
    expect(formatSelect.element.labels?.[0]).toBe(formatLabel.element)

    await formatPrefix.trigger('click')

    expect(showPicker).toHaveBeenCalledOnce()
  })

  it('タイトルアイコンからタイトルと説明のモーダルを開閉できる', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    const titleButton = wrapper.get<HTMLButtonElement>('.brand-title-button')

    expect(titleButton.attributes('aria-label')).toBe('このアプリについて')
    expect(titleButton.attributes('title')).toBeUndefined()
    expect(titleButton.attributes('data-tooltip')).toBe('このアプリについて')
    expect(titleButton.get('.brand-title-icon').attributes('alt')).toBe('Markdown Converter')
    expect(wrapper.find('.info-button').exists()).toBe(false)
    expect(wrapper.find('.info-modal').exists()).toBe(false)
    expect(wrapper.get('.app-content').attributes()).not.toHaveProperty('inert')

    await titleButton.trigger('mouseenter')
    expect(document.body.querySelector('.app-tooltip')?.textContent).toBe('このアプリについて')
    await titleButton.trigger('mouseleave')
    expect(document.body.querySelector('.app-tooltip')).toBeNull()

    await titleButton.trigger('click')

    const modal = wrapper.get('.info-modal')
    const closeButton = wrapper.get<HTMLButtonElement>('.modal-close-button')
    expect(modal.attributes('role')).toBe('dialog')
    expect(modal.attributes('aria-modal')).toBe('true')
    expect(wrapper.get('#info-modal-title').text()).toBe('Markdown Converter')
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

    const findEvent = new KeyboardEvent('keydown', {
      key: 'f',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    closeButton.element.dispatchEvent(findEvent)
    await wrapper.vm.$nextTick()
    expect(findEvent.defaultPrevented).toBe(false)
    expect(wrapper.find('.search-replace-panel').exists()).toBe(false)

    await modal.trigger('keydown', { key: 'Escape' })

    expect(wrapper.find('.info-modal').exists()).toBe(false)
    expect(document.activeElement).toBe(titleButton.element)
    wrapper.unmount()
  })

  it('設定ボタンでポップオーバーを開き、再押下で閉じる', async () => {
    const wrapper = mount(App)
    const settingsButton = wrapper.get<HTMLButtonElement>('.settings-button')
    const titleButton = wrapper.get<HTMLButtonElement>('.brand-title-button')

    expect(settingsButton.attributes('aria-label')).toBe('設定')
    expect(settingsButton.attributes('title')).toBeUndefined()
    expect(settingsButton.attributes('data-tooltip')).toBe('設定')
    expect(settingsButton.attributes('aria-expanded')).toBe('false')
    expect(settingsButton.find('[data-icon="settings"]').exists()).toBe(true)
    expect(titleButton.element.nextElementSibling).toBeNull()
    expect(wrapper.get('.app-header-actions').find('.settings-button').exists()).toBe(true)
    expect(wrapper.get('.format-field').element.previousElementSibling?.classList).toContain(
      'settings-root',
    )

    await settingsButton.trigger('click')

    expect(settingsButton.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('#settings-popover-title').text()).toBe('設定')

    await settingsButton.trigger('click')

    expect(settingsButton.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('#settings-popover').exists()).toBe(false)
  })

  it('ヘッダー左端からフォーカスモードへ切り替え、同じtextareaの編集位置を維持する', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    const settingsRoot = wrapper.get('.settings-root')
    const focusButton = wrapper.get<HTMLButtonElement>('.focus-mode-button')
    const input = wrapper.get<HTMLTextAreaElement>('#markdown-input')
    const textareaElement = input.element

    const titleButton = wrapper.get<HTMLButtonElement>('.brand-title-button')
    expect(wrapper.get('.brand-heading').element.firstElementChild).toBe(focusButton.element)
    expect(focusButton.element.nextElementSibling).toBe(titleButton.element)
    expect(settingsRoot.element.nextElementSibling).toBe(wrapper.get('.format-field').element)
    expect(wrapper.get('.format-field').element.nextElementSibling).toBe(
      wrapper.get('.copy-tooltip-target').element,
    )
    expect(wrapper.get('.brand-title-icon').attributes('alt')).toBe('Markdown Converter')
    expect(wrapper.get('.brand-title-icon').attributes('src')).toContain('title-icon-light.png')
    expect(focusButton.attributes('aria-label')).toBe('フォーカスモードを開始')
    expect(focusButton.attributes('data-tooltip')).toBe('フォーカスモードを開始（Esc）')
    expect(focusButton.find('[data-icon="focus"]').exists()).toBe(true)

    await input.setValue('0123456789')
    input.element.setSelectionRange(2, 6)
    input.element.scrollTop = 37
    input.element.scrollLeft = 4
    await wrapper.get('.input-guide-button').trigger('click')
    expect(wrapper.find('.input-guide-panel').exists()).toBe(true)
    await focusButton.trigger('click')
    await flushPromises()

    expect(wrapper.get('.app').classes()).toContain('app--focus-mode')
    expect(wrapper.find('.input-guide-panel').exists()).toBe(false)
    expect(wrapper.get<HTMLTextAreaElement>('#markdown-input').element).toBe(textareaElement)
    expect(input.element.selectionStart).toBe(2)
    expect(input.element.selectionEnd).toBe(6)
    expect(input.element.scrollTop).toBe(37)
    expect(input.element.scrollLeft).toBe(4)
    expect(document.activeElement).toBe(textareaElement)
    expect(wrapper.get('.app-header').isVisible()).toBe(false)
    expect(wrapper.find('.focus-mode-title-button').exists()).toBe(false)
    expect(wrapper.get('.focus-mode-control-buttons').element.firstElementChild).toBe(
      wrapper.get('.focus-mode-exit-button').element,
    )
    expect(wrapper.get('.focus-mode-exit-button').element.nextElementSibling).toBe(
      wrapper.get('.focus-mode-search-button').element,
    )
    expect(wrapper.get('.focus-mode-search-button').element.nextElementSibling).toBe(
      wrapper.get('.focus-mode-help-button').element,
    )
    expect(wrapper.get('.workspace-tabs').isVisible()).toBe(false)
    expect(wrapper.get('.workspace-splitter').isVisible()).toBe(false)
    expect(wrapper.get('.output-panel').isVisible()).toBe(false)
    expect(wrapper.find('.document-tabs').exists()).toBe(false)
    expect(wrapper.get('.focus-tab-name-button').text()).toBe('Untitled')
    expect(wrapper.get('.focus-tab-name-button').attributes('data-tooltip')).toBeUndefined()
    expect(wrapper.find('.panel-footer').isVisible()).toBe(false)
    expect(wrapper.get('#input-panel').attributes('role')).toBe('region')
    expect(wrapper.get('#input-panel').attributes('aria-label')).toBe('Markdown編集')

    input.element.setSelectionRange(5, 8)
    input.element.scrollTop = 53
    await wrapper.get('.focus-mode-exit-button').trigger('click')
    await flushPromises()

    expect(wrapper.get('.app').classes()).not.toContain('app--focus-mode')
    expect(wrapper.get<HTMLTextAreaElement>('#markdown-input').element).toBe(textareaElement)
    expect(input.element.selectionStart).toBe(5)
    expect(input.element.selectionEnd).toBe(8)
    expect(input.element.scrollTop).toBe(53)
    expect(document.activeElement).toBe(textareaElement)
    expect(wrapper.get('.workspace').attributes('data-active-panel')).toBe('input')
    wrapper.unmount()
  })

  it('フォーカスモードの検索ボタンから検索でき、Escapeは検索UIだけを閉じる', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    const input = wrapper.get<HTMLTextAreaElement>('#markdown-input')
    await input.setValue('focus focus')
    await wrapper.get('.focus-mode-button').trigger('click')

    const searchButton = wrapper.get<HTMLButtonElement>('.focus-mode-search-button')
    expect(searchButton.attributes('aria-label')).toBe('文章検索を開く')
    expect(searchButton.find('[data-icon="search"]').exists()).toBe(true)
    await searchButton.trigger('click')

    const searchInput = wrapper.get<HTMLInputElement>('#markdown-search-input')
    expect(document.activeElement).toBe(searchInput.element)
    await searchInput.setValue('focus')
    expect(wrapper.get('.search-result-status').text()).toBe('1 / 2')

    searchInput.element.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    )
    await flushPromises()

    expect(wrapper.find('.search-replace-panel').exists()).toBe(false)
    expect(wrapper.get('.app').classes()).toContain('app--focus-mode')

    input.element.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    )
    await flushPromises()

    expect(wrapper.get('.app').classes()).not.toContain('app--focus-mode')
    wrapper.unmount()
  })

  it('フォーカスモードの解説を開閉し、再度開始したときは閉じる', async () => {
    const wrapper = mount(App)

    await wrapper.get('.focus-mode-button').trigger('click')
    const helpButton = wrapper.get<HTMLButtonElement>('.focus-mode-help-button')
    expect(helpButton.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('#focus-mode-help').exists()).toBe(false)

    await helpButton.trigger('click')
    expect(helpButton.attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('#focus-mode-help .editor-input-guide').exists()).toBe(true)
    expect(wrapper.get('#focus-mode-help').text()).toContain('Ctrl / Command + B')
    expect(wrapper.get('#focus-mode-help').text()).toContain('Shift + Tab')

    await wrapper.get('.focus-mode-exit-button').trigger('click')
    await wrapper.get('.focus-mode-button').trigger('click')

    expect(wrapper.get<HTMLButtonElement>('.focus-mode-help-button').attributes('aria-expanded')).toBe(
      'false',
    )
    expect(wrapper.find('#focus-mode-help').exists()).toBe(false)
  })

  it('通常モードの入力支援をEscapeで閉じたときはフォーカスモードへ入らない', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    const guideButton = wrapper.get<HTMLButtonElement>('.input-guide-button')

    await guideButton.trigger('click')
    expect(wrapper.find('.input-guide-panel').exists()).toBe(true)

    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    )
    await flushPromises()

    expect(wrapper.find('.input-guide-panel').exists()).toBe(false)
    expect(wrapper.get('.app').classes()).not.toContain('app--focus-mode')
    expect(document.activeElement).toBe(guideButton.element)
    wrapper.unmount()
  })

  it('設定が先に処理したEscapeでは入力支援を開いたままにする', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    const guideButton = wrapper.get<HTMLButtonElement>('.input-guide-button')
    const settingsButton = wrapper.get<HTMLButtonElement>('.settings-button')

    await guideButton.trigger('click')
    await settingsButton.trigger('click')

    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    )
    await flushPromises()

    expect(wrapper.find('#settings-popover').exists()).toBe(false)
    expect(wrapper.find('.input-guide-panel').exists()).toBe(true)
    expect(wrapper.get('.app').classes()).not.toContain('app--focus-mode')
    expect(document.activeElement).toBe(settingsButton.element)
    wrapper.unmount()
  })

  it('フォーカス中のツールチップを閉じるEscapeではフォーカスモードへ入らない', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    const titleButton = wrapper.get<HTMLButtonElement>('.brand-title-button')

    await titleButton.trigger('focusin')
    expect(document.querySelector('.app-tooltip')).not.toBeNull()

    const handledEscapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    titleButton.element.dispatchEvent(handledEscapeEvent)
    await flushPromises()

    expect(handledEscapeEvent.defaultPrevented).toBe(true)
    expect(document.querySelector('.app-tooltip')).toBeNull()
    expect(wrapper.get('.app').classes()).not.toContain('app--focus-mode')

    const modeEscapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    titleButton.element.dispatchEvent(modeEscapeEvent)
    await flushPromises()

    expect(modeEscapeEvent.defaultPrevented).toBe(true)
    expect(wrapper.get('.app').classes()).toContain('app--focus-mode')
    wrapper.unmount()
  })

  it('タブ名編集中のEscapeは名称だけを戻し、それ以外ではフォーカスモードを終了する', async () => {
    const wrapper = mount(App, { attachTo: document.body })

    await wrapper.get('.focus-mode-button').trigger('click')
    await wrapper.get('.focus-tab-name-button').trigger('dblclick')
    const nameInput = wrapper.get<HTMLInputElement>('.focus-tab-name-input')
    await nameInput.setValue('変更しない')
    await nameInput.trigger('keydown', { key: 'Escape' })

    expect(wrapper.get('.app').classes()).toContain('app--focus-mode')
    expect(wrapper.get('.focus-tab-name-button').text()).toBe('Untitled')

    await wrapper.get('.focus-tab-name-button').trigger('dblclick')
    await wrapper.get<HTMLInputElement>('.focus-tab-name-input').setValue('  集中執筆  ')
    await wrapper.get<HTMLInputElement>('.focus-tab-name-input').trigger('keydown', {
      key: 'Enter',
    })
    expect(wrapper.get('.focus-tab-name-button').text()).toBe('集中執筆')

    wrapper.get<HTMLTextAreaElement>('#markdown-input').element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    await flushPromises()

    expect(wrapper.get('.app').classes()).not.toContain('app--focus-mode')
    expect(wrapper.get('.document-tab-button').text()).toBe('集中執筆')
    wrapper.unmount()
  })

  it('Escapeキーで通常モードとフォーカスモードを切り替える', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    const input = wrapper.get<HTMLTextAreaElement>('#markdown-input')
    input.element.focus()

    input.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    await flushPromises()

    expect(wrapper.get('.app').classes()).toContain('app--focus-mode')
    expect(document.activeElement).toBe(input.element)

    input.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    await flushPromises()

    expect(wrapper.get('.app').classes()).not.toContain('app--focus-mode')
    expect(document.activeElement).toBe(input.element)
    wrapper.unmount()
  })

  it('IME変換中のEscapeキーではフォーカスモードを切り替えない', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    const input = wrapper.get<HTMLTextAreaElement>('#markdown-input')
    input.element.focus()

    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      isComposing: true,
      bubbles: true,
      cancelable: true,
    })
    input.element.dispatchEvent(enterEvent)
    await flushPromises()

    expect(enterEvent.defaultPrevented).toBe(false)
    expect(wrapper.get('.app').classes()).not.toContain('app--focus-mode')

    await wrapper.get('.focus-mode-button').trigger('click')
    const exitEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      isComposing: true,
      bubbles: true,
      cancelable: true,
    })
    input.element.dispatchEvent(exitEvent)
    await flushPromises()

    expect(exitEvent.defaultPrevented).toBe(false)
    expect(wrapper.get('.app').classes()).toContain('app--focus-mode')
    wrapper.unmount()
  })

  it('フォーカスモード中だけ内部スクロールを強制し、設定値と表示状態を保存しない', async () => {
    localStorage.setItem(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        editorInternalScroll: false,
        workspaceSplitRatio: 0.5,
        normalizeFullWidthMarkdown: false,
      }),
    )
    const wrapper = mount(App)

    expect(wrapper.get('#markdown-input').classes()).toContain('text-area--expand')
    await wrapper.get('.focus-mode-button').trigger('click')

    expect(wrapper.get('.app').classes()).toContain('app--internal-scroll')
    expect(wrapper.get('#markdown-input').classes()).toContain('text-area--internal-scroll')
    expect(localStorage.getItem(APP_SETTINGS_STORAGE_KEY)).toBe(
      JSON.stringify({
        editorInternalScroll: false,
        workspaceSplitRatio: 0.5,
        normalizeFullWidthMarkdown: false,
      }),
    )

    wrapper.unmount()
    const reloadedWrapper = mount(App)
    expect(reloadedWrapper.get('.app').classes()).not.toContain('app--focus-mode')
    expect(reloadedWrapper.get('#markdown-input').classes()).toContain('text-area--expand')
  })

  it('設定ポップオーバーを外側クリックとEscキーで閉じる', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    const settingsButton = wrapper.get<HTMLButtonElement>('.settings-button')

    await settingsButton.trigger('click')
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('#settings-popover').exists()).toBe(false)

    await settingsButton.trigger('click')
    settingsButton.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    await wrapper.vm.$nextTick()

    expect(wrapper.find('#settings-popover').exists()).toBe(false)
    expect(wrapper.get('.app').classes()).not.toContain('app--focus-mode')
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
    expect(themeButton.attributes('data-tooltip')).toBe('ダークモードに切り替える')
    expect(themeButton.find('[data-icon="moon"]').exists()).toBe(true)
    expect(editorScrollSwitch.element.checked).toBe(true)
    expect(wrapper.get('.brand-title-icon').attributes('src')).toContain('title-icon-light.png')

    await themeButton.trigger('click')

    expect(wrapper.get('.app').attributes('data-theme')).toBe('dark')
    expect(wrapper.find('#settings-popover').exists()).toBe(true)
    expect(themeButton.attributes('aria-pressed')).toBe('true')
    expect(themeButton.attributes('aria-label')).toBe('ライトモードに切り替える')
    expect(themeButton.find('[data-icon="sun"]').exists()).toBe(true)
    expect(wrapper.get('.brand-title-icon').attributes('src')).toContain('title-icon-dark.png')

    await vi.advanceTimersByTimeAsync(THEME_PREFERENCE_SAVE_DELAY_MS)
    expect(localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe('dark')

    await themeButton.trigger('click')

    expect(wrapper.get('.app').attributes('data-theme')).toBe('light')
    expect(themeButton.attributes('aria-pressed')).toBe('false')
  })

  it('入力置換の有効設定とルールを管理・保存・復元する', async () => {
    const wrapper = mount(App, { attachTo: document.body })

    await wrapper.get('.settings-button').trigger('click')
    const enabledSwitch = wrapper.get<HTMLInputElement>('#input-replacement-setting')
    expect(enabledSwitch.element.checked).toBe(true)

    await enabledSwitch.setValue(false)
    expect(JSON.parse(localStorage.getItem(INPUT_REPLACEMENT_STORAGE_KEY)!)).toMatchObject({
      version: 1,
      enabled: false,
      rules: [],
    })

    await wrapper.get('.setting-manage-button').trigger('click')
    expect(wrapper.find('#settings-popover').exists()).toBe(false)
    expect(wrapper.get('.input-replacement-modal').attributes('aria-modal')).toBe('true')

    await wrapper.get('#new-replacement-source').setValue('あい')
    await wrapper.get('#new-replacement-value').setValue('AI')
    await wrapper.get('.input-replacement-add-form').trigger('submit')

    expect(JSON.parse(localStorage.getItem(INPUT_REPLACEMENT_STORAGE_KEY)!).rules).toMatchObject([
      { source: 'あい', replacement: 'AI', enabled: true },
    ])

    await wrapper.get('.input-replacement-modal-header .icon-button').trigger('click')
    expect(wrapper.find('.input-replacement-modal').exists()).toBe(false)
    expect(document.activeElement).toBe(
      wrapper.get<HTMLButtonElement>('.settings-button').element,
    )

    wrapper.unmount()
    const reloaded = mount(App)
    await reloaded.get('.settings-button').trigger('click')
    expect(
      reloaded.get<HTMLInputElement>('#input-replacement-setting').element.checked,
    ).toBe(false)
  })

  it('フォーカスモードでも通常画面と同じ入力置換ルールを使用する', async () => {
    localStorage.setItem(
      INPUT_REPLACEMENT_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        enabled: true,
        rules: [
          {
            id: 'ai',
            source: 'ai',
            replacement: 'AI',
            enabled: true,
          },
        ],
      }),
    )
    const wrapper = mount(App, { attachTo: document.body })

    await wrapper.get('.focus-mode-button').trigger('click')
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')
    await textarea.setValue('ai')
    textarea.element.setSelectionRange(2, 2)
    const event = new InputEvent('beforeinput', {
      data: ' ',
      inputType: 'insertText',
      bubbles: true,
      cancelable: true,
    })
    textarea.element.dispatchEvent(event)
    await flushPromises()

    expect(wrapper.get('.app').classes()).toContain('app--focus-mode')
    expect(textarea.element.value).toBe('AI ')
    wrapper.unmount()
  })

  it('フォーカスモードでも全角Markdown補正設定を使用する', async () => {
    localStorage.setItem(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        editorInternalScroll: true,
        workspaceSplitRatio: 0.5,
        normalizeFullWidthMarkdown: true,
      }),
    )
    const wrapper = mount(App, { attachTo: document.body })

    await wrapper.get('.focus-mode-button').trigger('click')
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')
    await textarea.setValue('＃')
    textarea.element.setSelectionRange(1, 1)
    textarea.element.dispatchEvent(
      new InputEvent('beforeinput', {
        data: '　',
        inputType: 'insertText',
        bubbles: true,
        cancelable: true,
      }),
    )
    await flushPromises()

    expect(wrapper.get('.app').classes()).toContain('app--focus-mode')
    expect(textarea.element.value).toBe('# ')
    wrapper.unmount()
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
      JSON.stringify({
        editorInternalScroll: false,
        workspaceSplitRatio: 0.5,
        normalizeFullWidthMarkdown: false,
      }),
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

  it('全角Markdown補正を初期OFFとし、ONへの変更を保存・復元する', async () => {
    const wrapper = mount(App)
    const input = wrapper.get<HTMLTextAreaElement>('#markdown-input')

    await wrapper.get('.settings-button').trigger('click')
    const setting = wrapper.get<HTMLInputElement>('#full-width-markdown-setting')
    expect(setting.element.checked).toBe(false)

    await setting.setValue(true)
    expect(
      JSON.parse(localStorage.getItem(APP_SETTINGS_STORAGE_KEY) ?? '{}'),
    ).toMatchObject({
      normalizeFullWidthMarkdown: true,
    })

    await input.setValue('＃')
    input.element.setSelectionRange(1, 1)
    input.element.dispatchEvent(
      new InputEvent('beforeinput', {
        data: '　',
        inputType: 'insertText',
        bubbles: true,
        cancelable: true,
      }),
    )
    await flushPromises()

    expect(input.element.value).toBe('# ')

    await input.setValue('＃　見出し')
    input.element.setSelectionRange(input.element.value.length, input.element.value.length)
    await input.trigger('keydown', { key: 'Enter' })

    expect(input.element.value).toBe('# 見出し\n')
    expect(wrapper.get<HTMLTextAreaElement>('#conversion-output').element.value).toBe(
      '*見出し*',
    )

    wrapper.unmount()
    const reloadedWrapper = mount(App)
    await reloadedWrapper.get('.settings-button').trigger('click')
    expect(
      reloadedWrapper.get<HTMLInputElement>('#full-width-markdown-setting').element.checked,
    ).toBe(true)
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

  it('出力ペイン表示中の検索・置換ショートカットで入力ペインを表示する', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    const outputTab = wrapper.get<HTMLButtonElement>('#output-tab')

    await outputTab.trigger('click')
    const searchEvent = new KeyboardEvent('keydown', {
      key: 'f',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    outputTab.element.dispatchEvent(searchEvent)
    await flushPromises()

    expect(searchEvent.defaultPrevented).toBe(true)
    expect(wrapper.get('.workspace').attributes('data-active-panel')).toBe('input')
    expect(document.activeElement).toBe(
      wrapper.get<HTMLInputElement>('#markdown-search-input').element,
    )
    expect(wrapper.find('#markdown-replace-row').exists()).toBe(false)

    await wrapper.get('.search-close-button').trigger('click')
    await outputTab.trigger('click')
    const replaceEvent = new KeyboardEvent('keydown', {
      key: 'h',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    outputTab.element.dispatchEvent(replaceEvent)
    await flushPromises()

    expect(replaceEvent.defaultPrevented).toBe(true)
    expect(wrapper.get('.workspace').attributes('data-active-panel')).toBe('input')
    expect(document.activeElement).toBe(
      wrapper.get<HTMLInputElement>('#markdown-replacement-input').element,
    )
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

  it('左右ペインの区切りをキーボードで調整し、ダブルクリックで均等へ戻す', async () => {
    const wrapper = mount(App)
    const splitter = wrapper.get<HTMLElement>('.workspace-splitter')

    expect(splitter.attributes('role')).toBe('separator')
    expect(splitter.attributes('aria-orientation')).toBe('vertical')
    expect(splitter.attributes('aria-valuenow')).toBe('50')
    expect(splitter.attributes('aria-valuetext')).toBe('左ペイン50%、右ペイン50%')

    await splitter.trigger('keydown', { key: 'ArrowRight' })

    expect(splitter.attributes('aria-valuenow')).toBe('55')
    expect(JSON.parse(localStorage.getItem(APP_SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject({
      workspaceSplitRatio: 0.55,
    })

    await splitter.trigger('keydown', { key: 'End' })
    expect(splitter.attributes('aria-valuenow')).toBe('80')

    await splitter.trigger('dblclick')
    expect(splitter.attributes('aria-valuenow')).toBe('50')
  })

  it('区切りをドラッグして各ペインの最小幅を保ちながら比率を変更する', async () => {
    const wrapper = mount(App)
    const workspace = wrapper.get<HTMLElement>('.workspace')
    const splitter = wrapper.get<HTMLElement>('.workspace-splitter')

    vi.spyOn(workspace.element, 'getBoundingClientRect').mockReturnValue({
      width: 1000,
      height: 620,
      top: 0,
      right: 1000,
      bottom: 620,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    function dispatchPointerEvent(type: string, clientX: number): void {
      const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX,
      })
      Object.defineProperty(event, 'pointerId', { value: 1 })
      splitter.element.dispatchEvent(event)
    }

    dispatchPointerEvent('pointerdown', 500)
    dispatchPointerEvent('pointermove', 700)
    await flushPromises()

    expect(splitter.attributes('aria-valuenow')).toBe('70')
    expect(workspace.element.style.gridTemplateColumns).toBe('690.018px 20px 289.982px')
    expect(wrapper.get('.workspace').classes()).toContain('workspace--resizing')

    dispatchPointerEvent('pointermove', 50)
    await flushPromises()
    expect(splitter.attributes('aria-valuenow')).toBe('29')
    expect(workspace.element.style.gridTemplateColumns).toBe('280px 20px 700px')

    dispatchPointerEvent('pointerup', 50)
    await flushPromises()
    expect(wrapper.get('.workspace').classes()).not.toContain('workspace--resizing')
  })

  it('テーマを手動で切り替えられる', async () => {
    const wrapper = mount(App)
    await wrapper.get('.settings-button').trigger('click')
    const themeButton = wrapper.get<HTMLButtonElement>('#dark-mode-setting')

    expect(wrapper.get('.app').attributes('data-theme')).toBe('light')
    expect(themeButton.attributes('aria-pressed')).toBe('false')
    expect(themeButton.attributes('aria-label')).toBe('ダークモードに切り替える')
    expect(themeButton.attributes('data-tooltip')).toBe('ダークモードに切り替える')
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
    expect(wrapper.get('.copy-tooltip-target').attributes('data-tooltip')).toBe('コピーしました')
    expect(wrapper.get('.app-notice').text()).toBe('Backlog記法形式でコピーしました')
    expect(wrapper.get('.app-notice').attributes('role')).toBe('status')
    expect(wrapper.get('.app-notice').classes()).toContain('toast-notice')

    await vi.advanceTimersByTimeAsync(COPY_NOTICE_DURATION_MS)
    expect(wrapper.find('.app-notice').exists()).toBe(false)
    expect(wrapper.get('.copy-button').find('[data-icon="copy"]').exists()).toBe(true)
    expect(wrapper.get('.copy-tooltip-target').attributes('data-tooltip')).toBe('コピー')
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
