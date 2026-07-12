import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MarkdownEditor from './MarkdownEditor.vue'

describe('MarkdownEditor', () => {
  it('内部スクロールONでは固定高用の表示モードを使用する', () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        modelValue: '',
        characterCount: 0,
        editorInternalScroll: true,
      },
    })
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')

    expect(textarea.classes()).toContain('text-area--internal-scroll')
    expect(textarea.element.style.height).toBe('')
  })

  it('内部スクロールOFFでは内容の増減に合わせて高さを再計算する', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        modelValue: '',
        characterCount: 0,
        editorInternalScroll: false,
      },
    })
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')
    let scrollHeight = 640
    Object.defineProperty(textarea.element, 'scrollHeight', {
      configurable: true,
      get: () => scrollHeight,
    })

    await textarea.setValue('長い入力')
    expect(textarea.classes()).toContain('text-area--expand')
    expect(textarea.element.style.height).toBe('640px')

    scrollHeight = 180
    await textarea.setValue('')
    expect(textarea.element.style.height).toBe('180px')
  })

  it('内部スクロールONへ戻すと計算済みのインライン高さを解除する', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        modelValue: '入力',
        characterCount: 2,
        editorInternalScroll: false,
      },
    })
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')
    Object.defineProperty(textarea.element, 'scrollHeight', {
      configurable: true,
      value: 420,
    })

    await textarea.setValue('入力を更新')
    expect(textarea.element.style.height).toBe('420px')

    await wrapper.setProps({ editorInternalScroll: true })
    expect(textarea.element.style.height).toBe('')
    expect(textarea.classes()).toContain('text-area--internal-scroll')
  })
})
