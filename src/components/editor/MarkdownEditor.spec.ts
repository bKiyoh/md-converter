import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import MarkdownEditor from './MarkdownEditor.vue'

function mountInteractiveEditor(initialValue: string) {
  return mount(
    defineComponent({
      components: { MarkdownEditor },
      setup() {
        const value = ref(initialValue)
        return { value }
      },
      template: `
        <MarkdownEditor
          v-model="value"
          :character-count="value.length"
          :editor-internal-scroll="true"
        />
      `,
    }),
    { attachTo: document.body },
  )
}

describe('MarkdownEditor', () => {
  it('ドラッグ選択相当の範囲へキーボードで取り消し線を適用する', async () => {
    const wrapper = mountInteractiveEditor('テスト文章')
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')

    textarea.element.focus()
    textarea.element.setSelectionRange(0, 3)
    await textarea.trigger('keydown', {
      code: 'KeyX',
      key: 'X',
      ctrlKey: true,
      shiftKey: true,
    })

    expect(textarea.element.value).toBe('~~テスト~~文章')
    expect(textarea.element.selectionStart).toBe(2)
    expect(textarea.element.selectionEnd).toBe(5)
    wrapper.unmount()
  })

  it('複数行をキーボードで番号付きリストへ加工する', async () => {
    const wrapper = mountInteractiveEditor('A\nB')
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')

    textarea.element.focus()
    textarea.element.setSelectionRange(0, 3)
    await textarea.trigger('keydown', {
      code: 'Digit7',
      key: '7',
      ctrlKey: true,
      shiftKey: true,
    })

    expect(textarea.element.value).toBe('1. A\n2. B')
    expect(textarea.element.selectionStart).toBe(0)
    expect(textarea.element.selectionEnd).toBe(9)
    wrapper.unmount()
  })

  it('IME変換中は追加したショートカットを実行しない', async () => {
    const wrapper = mountInteractiveEditor('テスト')
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')

    textarea.element.focus()
    textarea.element.setSelectionRange(0, 3)
    await textarea.trigger('keydown', {
      code: 'KeyE',
      key: 'e',
      ctrlKey: true,
      isComposing: true,
    })

    expect(textarea.element.value).toBe('テスト')
    wrapper.unmount()
  })

  it('箇条書きの文章途中でEnterすると次のリスト項目へ分割する', async () => {
    const wrapper = mountInteractiveEditor('- テスト')
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')

    textarea.element.focus()
    textarea.element.setSelectionRange(3, 3)
    await textarea.trigger('keydown', { key: 'Enter' })

    expect(textarea.element.value).toBe('- テ\n- スト')
    expect(textarea.element.selectionStart).toBe(6)
    expect(textarea.element.selectionEnd).toBe(6)
    wrapper.unmount()
  })

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
