import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MARKDOWN_DRAFT_SAVE_DELAY_MS,
  MARKDOWN_DRAFT_STORAGE_KEY,
  useMarkdownDraft,
  type DraftStorage,
} from './useMarkdownDraft'

function mountDraft(storage: DraftStorage): VueWrapper {
  return mount(
    defineComponent({
      setup() {
        return useMarkdownDraft(storage)
      },
      template: '<textarea v-model="markdown" />',
    }),
  )
}

describe('useMarkdownDraft', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('保存済みのMarkdown入力を初期表示時に復元する', () => {
    const storage = {
      getItem: vi.fn(() => '# 復元する内容'),
      setItem: vi.fn(),
    }

    const wrapper = mountDraft(storage)

    expect(wrapper.get<HTMLTextAreaElement>('textarea').element.value).toBe('# 復元する内容')
    expect(storage.getItem).toHaveBeenCalledWith(MARKDOWN_DRAFT_STORAGE_KEY)
  })

  it('最後の入力から500ms後にMarkdown入力だけを保存する', async () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    }
    const wrapper = mountDraft(storage)
    const input = wrapper.get<HTMLTextAreaElement>('textarea')

    await input.setValue('入力途中')
    await vi.advanceTimersByTimeAsync(MARKDOWN_DRAFT_SAVE_DELAY_MS - 1)
    expect(storage.setItem).not.toHaveBeenCalled()

    await input.setValue('保存するMarkdown')
    await vi.advanceTimersByTimeAsync(MARKDOWN_DRAFT_SAVE_DELAY_MS - 1)
    expect(storage.setItem).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(storage.setItem).toHaveBeenCalledTimes(1)
    expect(storage.setItem).toHaveBeenCalledWith(
      MARKDOWN_DRAFT_STORAGE_KEY,
      '保存するMarkdown',
    )
  })

  it('破棄時に未保存の最新入力を保存する', async () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    }
    const wrapper = mountDraft(storage)

    await wrapper.get<HTMLTextAreaElement>('textarea').setValue('破棄直前の入力')
    wrapper.unmount()

    expect(storage.setItem).toHaveBeenCalledWith(
      MARKDOWN_DRAFT_STORAGE_KEY,
      '破棄直前の入力',
    )
  })

  it('Storageの読み書きが失敗しても入力を維持する', async () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new DOMException('denied')
      }),
      setItem: vi.fn(() => {
        throw new DOMException('quota exceeded')
      }),
    }
    const wrapper = mountDraft(storage)
    const input = wrapper.get<HTMLTextAreaElement>('textarea')

    expect(input.element.value).toBe('')

    await input.setValue('保存できなくても残る入力')
    await vi.advanceTimersByTimeAsync(MARKDOWN_DRAFT_SAVE_DELAY_MS)

    expect(input.element.value).toBe('保存できなくても残る入力')
    expect(storage.setItem).toHaveBeenCalledWith(
      MARKDOWN_DRAFT_STORAGE_KEY,
      '保存できなくても残る入力',
    )
  })
})
