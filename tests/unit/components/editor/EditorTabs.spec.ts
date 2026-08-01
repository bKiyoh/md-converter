import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DeletedTab, EditorTab } from '../../../../src/types/editorTabs'
import EditorTabs from '../../../../src/components/editor/EditorTabs.vue'

function createTab(id: string, name: string): EditorTab {
  return {
    id,
    name,
    content: `${name}の本文`,
    createdAt: 100,
    updatedAt: 100,
  }
}

function createDataTransfer(): DataTransfer {
  return {
    effectAllowed: 'none',
    dropEffect: 'none',
    setData: vi.fn(),
  } as unknown as DataTransfer
}

describe('EditorTabs', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  function mountEditorTabs(): VueWrapper {
    const tabs = [
      createTab('tab-1', '先頭'),
      createTab('tab-2', '中央'),
      createTab('tab-3', '末尾'),
    ]

    wrapper = mount(EditorTabs, {
      props: {
        tabs,
        deletedTabs: [] as DeletedTab[],
        activeTabId: 'tab-2',
        canAddTab: true,
        canDeleteTab: true,
      },
    })
    return wrapper
  }

  it('ドラッグ対象と挿入予定位置を表示し、ドロップ時だけ並べ替えを要求する', async () => {
    const currentWrapper = mountEditorTabs()
    const items = currentWrapper.findAll<HTMLElement>('.document-tab-item')
    const buttons = currentWrapper.findAll<HTMLButtonElement>('.document-tab-button')
    const dataTransfer = createDataTransfer()

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

    await buttons[0]!.trigger('dragstart', { dataTransfer })

    expect(items[0]!.classes()).toContain('document-tab-item--dragging')
    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'tab-1')

    await items[2]!.trigger('dragover', { clientX: 110, dataTransfer })

    expect(items[2]!.classes()).toContain('document-tab-item--drop-before')
    expect(currentWrapper.emitted('reorder')).toBeUndefined()

    await items[2]!.trigger('drop', { clientX: 110, dataTransfer })

    expect(currentWrapper.emitted('reorder')).toEqual([['tab-1', 'tab-3', 'before']])

    await buttons[0]!.trigger('dragend', { dataTransfer })

    expect(items[0]!.classes()).not.toContain('document-tab-item--dragging')
    expect(items[2]!.classes()).not.toContain('document-tab-item--drop-before')
  })

  it('タブ外へドロップした場合は並べ替えず、ドラッグ直後のクリックだけを抑止する', async () => {
    const currentWrapper = mountEditorTabs()
    const targetItem = currentWrapper.findAll<HTMLElement>('.document-tab-item')[1]!
    const firstButton = currentWrapper.findAll<HTMLButtonElement>('.document-tab-button')[0]!
    const dataTransfer = createDataTransfer()

    await firstButton.trigger('dragstart', { dataTransfer })
    await targetItem.trigger('dragover', { clientX: 1, dataTransfer })
    expect(targetItem.classes()).toContain('document-tab-item--drop-after')

    document.body.dispatchEvent(new Event('drop', { bubbles: true }))
    await firstButton.trigger('dragend', { dataTransfer })
    await firstButton.trigger('click')

    expect(currentWrapper.emitted('reorder')).toBeUndefined()
    expect(currentWrapper.emitted('select')).toBeUndefined()
    expect(targetItem.classes()).not.toContain('document-tab-item--drop-after')

    await vi.runAllTimersAsync()
    await firstButton.trigger('click')

    expect(currentWrapper.emitted('select')).toEqual([['tab-1']])
  })

  it('タブ名の編集中はドラッグを開始せず、通常クリックではタブを切り替える', async () => {
    const currentWrapper = mountEditorTabs()
    const buttons = currentWrapper.findAll<HTMLButtonElement>('.document-tab-button')

    await buttons[2]!.trigger('click')
    expect(currentWrapper.emitted('select')).toEqual([['tab-3']])

    await buttons[0]!.trigger('dblclick')
    const input = currentWrapper.get<HTMLInputElement>('.document-tab-name-input')

    expect(input.attributes('draggable')).toBeUndefined()

    await input.trigger('dragstart', { dataTransfer: createDataTransfer() })
    expect(currentWrapper.emitted('reorder')).toBeUndefined()
  })

  it('F2キーでタブ名の編集を開始する', async () => {
    const currentWrapper = mountEditorTabs()
    const button = currentWrapper.findAll<HTMLButtonElement>('.document-tab-button')[1]!

    expect(button.attributes('aria-keyshortcuts')).toContain('F2')
    await button.trigger('keydown', { key: 'F2' })

    const input = currentWrapper.get<HTMLInputElement>('.document-tab-name-input')
    await input.setValue('更新名')
    await input.trigger('keydown', { key: 'Enter' })

    expect(currentWrapper.emitted('rename')).toEqual([['tab-2', '更新名']])
  })

  it('Alt+左右キーで隣へ並べ替え、移動位置を通知する', async () => {
    const currentWrapper = mountEditorTabs()
    const buttons = currentWrapper.findAll<HTMLButtonElement>('.document-tab-button')

    await buttons[1]!.trigger('keydown', { key: 'ArrowRight', altKey: true })

    expect(currentWrapper.emitted('reorder')).toEqual([
      ['tab-2', 'tab-3', 'after'],
    ])
    expect(currentWrapper.get('[aria-live="polite"]').text()).toBe(
      '中央を3番目へ移動しました',
    )

    await buttons[0]!.trigger('keydown', { key: 'ArrowLeft', altKey: true })
    expect(currentWrapper.emitted('reorder')).toHaveLength(1)
  })

  it('IME変換中はF2とキーボード並べ替えを処理しない', async () => {
    const currentWrapper = mountEditorTabs()
    const button = currentWrapper.findAll<HTMLButtonElement>('.document-tab-button')[1]!

    await button.trigger('keydown', { key: 'F2', isComposing: true })
    await button.trigger('keydown', {
      key: 'ArrowRight',
      altKey: true,
      isComposing: true,
    })

    expect(currentWrapper.find('.document-tab-name-input').exists()).toBe(false)
    expect(currentWrapper.emitted('reorder')).toBeUndefined()
  })
})
