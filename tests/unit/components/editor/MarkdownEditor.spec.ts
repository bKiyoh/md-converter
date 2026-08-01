import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { InputReplacementRule } from '../../../../src/types/inputReplacement'
import MarkdownEditor from '../../../../src/components/editor/MarkdownEditor.vue'

function mountInteractiveEditor(
  initialValue: string,
  inputReplacementRules: InputReplacementRule[] = [],
  inputReplacementEnabled = true,
  normalizeFullWidthMarkdown = false,
) {
  return mount(
    defineComponent({
      components: { MarkdownEditor },
      setup() {
        const value = ref(initialValue)
        const editor = ref<InstanceType<typeof MarkdownEditor> | null>(null)

        function handleSearchRequest(showReplace: boolean): void {
          void editor.value?.openSearch(showReplace)
        }

        return {
          editor,
          handleSearchRequest,
          inputReplacementEnabled,
          inputReplacementRules,
          normalizeFullWidthMarkdown,
          value,
        }
      },
      template: `
        <MarkdownEditor
          ref="editor"
          v-model="value"
          :character-count="value.length"
          :editor-internal-scroll="true"
          :input-replacement-enabled="inputReplacementEnabled"
          :input-replacement-rules="inputReplacementRules"
          :normalize-full-width-markdown="normalizeFullWidthMarkdown"
          @request-search="handleSearchRequest"
        />
      `,
    }),
    { attachTo: document.body },
  )
}

describe('MarkdownEditor', () => {
  const replacementRules: InputReplacementRule[] = [
    { id: 'ai', source: 'ai', replacement: 'AI', enabled: true },
    { id: 'right', source: '右', replacement: '⇨', enabled: true },
    { id: 'disabled', source: 'off', replacement: 'ON', enabled: false },
  ]

  it('直接入力のSpaceで完全一致を置換し、Spaceを保持する', async () => {
    const wrapper = mountInteractiveEditor('ai', replacementRules)
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')
    textarea.element.setSelectionRange(2, 2)

    const event = new InputEvent('beforeinput', {
      data: ' ',
      inputType: 'insertText',
      bubbles: true,
      cancelable: true,
    })
    textarea.element.dispatchEvent(event)
    await flushPromises()

    expect(event.defaultPrevented).toBe(true)
    expect(textarea.element.value).toBe('AI ')
    expect(textarea.element.selectionStart).toBe(3)
    wrapper.unmount()
  })

  it('内部のinsertTextがbeforeinputを発火しても編集処理へ再入しない', async () => {
    const rules: InputReplacementRule[] = [
      {
        id: 'recursive',
        source: 'ai',
        replacement: 'ai＊',
        enabled: true,
      },
    ]
    const wrapper = mountInteractiveEditor('ai', rules, true, true)
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'execCommand',
    )
    const programmaticBeforeInputs: InputEvent[] = []
    const execCommand = vi.fn(
      (_command: string, _showUi: boolean, value?: string): boolean => {
        const insertedText = value ?? ''
        const programmaticBeforeInput = new InputEvent('beforeinput', {
          data: insertedText,
          inputType: 'insertText',
          bubbles: true,
          cancelable: true,
        })
        programmaticBeforeInputs.push(programmaticBeforeInput)
        textarea.element.dispatchEvent(programmaticBeforeInput)

        if (programmaticBeforeInput.defaultPrevented) {
          return false
        }

        textarea.element.setRangeText(
          insertedText,
          textarea.element.selectionStart,
          textarea.element.selectionEnd,
          'end',
        )
        textarea.element.dispatchEvent(
          new InputEvent('input', {
            data: insertedText,
            inputType: 'insertText',
            bubbles: true,
          }),
        )
        return true
      },
    )
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    })

    try {
      textarea.element.setSelectionRange(2, 2)
      const event = new InputEvent('beforeinput', {
        data: ' ',
        inputType: 'insertText',
        bubbles: true,
        cancelable: true,
      })
      textarea.element.dispatchEvent(event)
      await flushPromises()

      expect(event.defaultPrevented).toBe(true)
      expect(programmaticBeforeInputs[0]?.defaultPrevented).toBe(false)
      expect(execCommand).toHaveBeenCalledTimes(1)
      expect(textarea.element.value).toBe('ai＊ ')
    } finally {
      wrapper.unmount()
      if (originalDescriptor) {
        Object.defineProperty(document, 'execCommand', originalDescriptor)
      } else {
        Reflect.deleteProperty(document, 'execCommand')
      }
    }
  })

  it('内部空白を含む長いルールが未完成の間は短いルールを置換しない', async () => {
    const overlappingRules: InputReplacementRule[] = [
      { id: 'short', source: 'foo', replacement: '短縮', enabled: true },
      { id: 'long', source: 'foo bar', replacement: '長文', enabled: true },
    ]
    const wrapper = mountInteractiveEditor('foo', overlappingRules)
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')
    textarea.element.setSelectionRange(3, 3)

    const firstSpace = new InputEvent('beforeinput', {
      data: ' ',
      inputType: 'insertText',
      bubbles: true,
      cancelable: true,
    })
    textarea.element.dispatchEvent(firstSpace)

    expect(firstSpace.defaultPrevented).toBe(false)

    await textarea.setValue('foo bar')
    textarea.element.setSelectionRange(7, 7)
    const finalSpace = new InputEvent('beforeinput', {
      data: ' ',
      inputType: 'insertText',
      bubbles: true,
      cancelable: true,
    })
    textarea.element.dispatchEvent(finalSpace)
    await flushPromises()

    expect(finalSpace.defaultPrevented).toBe(true)
    expect(textarea.element.value).toBe('長文 ')
    wrapper.unmount()
  })

  it('部分一致、無効ルール、貼り付けでは置換しない', async () => {
    const wrapper = mountInteractiveEditor('right ai', replacementRules)
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')
    textarea.element.setSelectionRange(5, 5)

    const spaceEvent = new InputEvent('beforeinput', {
      data: ' ',
      inputType: 'insertText',
      bubbles: true,
      cancelable: true,
    })
    textarea.element.dispatchEvent(spaceEvent)
    expect(spaceEvent.defaultPrevented).toBe(false)

    await textarea.setValue('off')
    textarea.element.setSelectionRange(3, 3)
    const disabledEvent = new InputEvent('beforeinput', {
      data: ' ',
      inputType: 'insertText',
      bubbles: true,
      cancelable: true,
    })
    textarea.element.dispatchEvent(disabledEvent)
    expect(disabledEvent.defaultPrevented).toBe(false)

    await textarea.setValue('右')
    expect(textarea.element.value).toBe('右')
    wrapper.unmount()
  })

  it('Enterでは入力置換後にMarkdownリストを継続する', async () => {
    const wrapper = mountInteractiveEditor('- 右', replacementRules)
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')
    textarea.element.setSelectionRange(3, 3)

    await textarea.trigger('keydown', { key: 'Enter' })

    expect(textarea.element.value).toBe('- ⇨\n- ')
    expect(textarea.element.selectionStart).toBe(6)
    wrapper.unmount()
  })

  it('IME確定後に一度だけ置換する', async () => {
    const wrapper = mountInteractiveEditor('', replacementRules)
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')

    await textarea.trigger('compositionstart')
    await textarea.setValue('右')
    textarea.element.setSelectionRange(1, 1)
    await textarea.trigger('compositionend', { data: '右' })
    await flushPromises()

    expect(textarea.element.value).toBe('⇨')
    wrapper.unmount()
  })

  it('IME確定に使用したEnterでは改行とリスト継続を実行しない', async () => {
    const wrapper = mountInteractiveEditor('- ', replacementRules)
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')
    textarea.element.setSelectionRange(2, 2)

    await textarea.trigger('compositionstart')
    await textarea.setValue('- 右')
    textarea.element.setSelectionRange(3, 3)
    await textarea.trigger('keydown', { key: 'Enter', isComposing: true })
    await textarea.trigger('compositionend', { data: '右' })
    await flushPromises()

    expect(textarea.element.value).toBe('- ⇨')
    expect(textarea.element.value).not.toContain('\n')
    wrapper.unmount()
  })

  it('IME入力をキャンセルした場合は置換しない', async () => {
    const wrapper = mountInteractiveEditor('右', replacementRules)
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')

    await textarea.trigger('compositionstart')
    await textarea.trigger('compositionend', { data: '' })
    await flushPromises()

    expect(textarea.element.value).toBe('右')
    wrapper.unmount()
  })

  it('IMEから全角Spaceを入力した場合も区切りを保持する', async () => {
    const wrapper = mountInteractiveEditor('ai', replacementRules)
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')
    textarea.element.setSelectionRange(2, 2)

    await textarea.trigger('compositionstart')
    await textarea.setValue('ai　')
    textarea.element.setSelectionRange(3, 3)
    await textarea.trigger('compositionend', { data: '　' })
    await flushPromises()

    expect(textarea.element.value).toBe('AI　')
    expect(textarea.element.selectionStart).toBe(3)
    wrapper.unmount()
  })

  it('インラインコードとコードブロック内では置換しない', () => {
    const wrapper = mountInteractiveEditor('`右`\n```\n右\n```', replacementRules)
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')

    textarea.element.setSelectionRange(2, 2)
    const inlineEvent = new InputEvent('beforeinput', {
      data: ' ',
      inputType: 'insertText',
      bubbles: true,
      cancelable: true,
    })
    textarea.element.dispatchEvent(inlineEvent)

    textarea.element.setSelectionRange(9, 9)
    const blockEvent = new InputEvent('beforeinput', {
      data: ' ',
      inputType: 'insertText',
      bubbles: true,
      cancelable: true,
    })
    textarea.element.dispatchEvent(blockEvent)

    expect(inlineEvent.defaultPrevented).toBe(false)
    expect(blockEvent.defaultPrevented).toBe(false)
    expect(textarea.element.value).toBe('`右`\n```\n右\n```')
    wrapper.unmount()
  })

  it('置換後の文字列へ別ルールを連続適用しない', async () => {
    const chainedRules: InputReplacementRule[] = [
      { id: 'a', source: 'A', replacement: 'B', enabled: true },
      { id: 'b', source: 'B', replacement: 'C', enabled: true },
    ]
    const wrapper = mountInteractiveEditor('A', chainedRules)
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')
    textarea.element.setSelectionRange(1, 1)
    textarea.element.dispatchEvent(
      new InputEvent('beforeinput', {
        data: ' ',
        inputType: 'insertText',
        bubbles: true,
        cancelable: true,
      }),
    )
    await flushPromises()

    expect(textarea.element.value).toBe('B ')
    wrapper.unmount()
  })

  it('全角Markdown補正がOFFの場合は全角記号を変更しない', () => {
    const wrapper = mountInteractiveEditor('＃')
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')
    textarea.element.setSelectionRange(1, 1)

    const event = new InputEvent('beforeinput', {
      data: '　',
      inputType: 'insertText',
      bubbles: true,
      cancelable: true,
    })
    textarea.element.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(textarea.element.value).toBe('＃')
    wrapper.unmount()
  })

  it('全角Markdown補正がONの場合は直接入力の構文を半角化する', async () => {
    const wrapper = mountInteractiveEditor('＃', [], true, true)
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')
    textarea.element.setSelectionRange(1, 1)

    const event = new InputEvent('beforeinput', {
      data: '　',
      inputType: 'insertText',
      bubbles: true,
      cancelable: true,
    })
    textarea.element.dispatchEvent(event)
    await flushPromises()

    expect(event.defaultPrevented).toBe(true)
    expect(textarea.element.value).toBe('# ')
    expect(textarea.element.selectionStart).toBe(2)
    wrapper.unmount()
  })

  it.each([
    ['＃', '#'],
    ['＊', '*'],
    ['＿', '_'],
    ['～', '~'],
    ['－', '-'],
    ['ー', '-'],
    ['＋', '+'],
    ['＞', '>'],
    ['｀', '`'],
    ['［', '['],
    ['］', ']'],
    ['（', '('],
    ['）', ')'],
    ['｜', '|'],
    ['１．', '1.'],
  ])('全角Markdown記号 %s の直接入力を即座に %s へ補正する', async (
    input,
    expected,
  ) => {
    const wrapper = mountInteractiveEditor('', [], true, true)
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')

    const event = new InputEvent('beforeinput', {
      data: input,
      inputType: 'insertText',
      bubbles: true,
      cancelable: true,
    })
    textarea.element.dispatchEvent(event)
    await flushPromises()

    expect(event.defaultPrevented).toBe(true)
    expect(textarea.element.value).toBe(expected)
    wrapper.unmount()
  })

  it.each(['．', '：'])(
    '通常文章用の全角記号 %s は直接入力時に補正しない',
    (input) => {
      const wrapper = mountInteractiveEditor('注', [], true, true)
      const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')
      textarea.element.setSelectionRange(1, 1)

      const event = new InputEvent('beforeinput', {
        data: input,
        inputType: 'insertText',
        bubbles: true,
        cancelable: true,
      })
      textarea.element.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(false)
      expect(textarea.element.value).toBe('注')
      wrapper.unmount()
    },
  )

  it('IME確定後に全角のインライン構文を半角化する', async () => {
    const wrapper = mountInteractiveEditor('', [], true, true)
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')

    await textarea.trigger('compositionstart')
    await textarea.setValue('＊補足＊')
    textarea.element.setSelectionRange(4, 4)
    await textarea.trigger('compositionend', { data: '＊補足＊' })
    await flushPromises()

    expect(textarea.element.value).toBe('*補足*')
    expect(textarea.element.selectionStart).toBe(4)
    wrapper.unmount()
  })

  it('IMEで全角コード区切りと同時に確定したコード本文を補正しない', async () => {
    const wrapper = mountInteractiveEditor('', [], true, true)
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')

    await textarea.trigger('compositionstart')
    await textarea.setValue('｀＊code＊｀')
    textarea.element.setSelectionRange(8, 8)
    await textarea.trigger('compositionend', { data: '｀＊code＊｀' })
    await flushPromises()

    expect(textarea.element.value).toBe('`＊code＊`')
    wrapper.unmount()
  })

  it('IMEで確定した全角見出し記号1文字を即座に半角化する', async () => {
    const wrapper = mountInteractiveEditor('', [], true, true)
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')

    await textarea.trigger('compositionstart')
    await textarea.setValue('＃')
    textarea.element.setSelectionRange(1, 1)
    await textarea.trigger('compositionend', { data: '＃' })
    await flushPromises()

    expect(textarea.element.value).toBe('#')
    wrapper.unmount()
  })

  it('IMEで行頭へ入力した長音記号を半角ハイフンへ補正する', async () => {
    const wrapper = mountInteractiveEditor('', [], true, true)
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')

    await textarea.trigger('compositionstart')
    await textarea.setValue('ー')
    textarea.element.setSelectionRange(1, 1)
    await textarea.trigger('compositionend', { data: 'ー' })
    await flushPromises()

    expect(textarea.element.value).toBe('-')
    expect(textarea.element.selectionStart).toBe(1)
    wrapper.unmount()
  })

  it('Enterでは全角リスト補正、入力置換、リスト継続を1回で反映する', async () => {
    const wrapper = mountInteractiveEditor(
      '－　右',
      replacementRules,
      true,
      true,
    )
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')
    textarea.element.setSelectionRange(3, 3)

    await textarea.trigger('keydown', { key: 'Enter' })

    expect(textarea.element.value).toBe('- ⇨\n- ')
    expect(textarea.element.selectionStart).toBe(6)
    wrapper.unmount()
  })

  it('コード本文と貼り付け相当の外部更新は全角Markdown補正の対象外にする', async () => {
    const wrapper = mountInteractiveEditor('', [], true, true)
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')

    await textarea.setValue('```\n＃　見出し\n```')
    expect(textarea.element.value).toBe('```\n＃　見出し\n```')

    textarea.element.setSelectionRange(10, 10)
    await textarea.trigger('keydown', { key: 'Enter' })
    expect(textarea.element.value).toContain('＃　見出し')
    wrapper.unmount()
  })

  it.each(['a', ' '])(
    '通常入力 %j を契機に既存の全角Markdown記号を補正しない',
    (input) => {
      const wrapper = mountInteractiveEditor('＃貼り付け', [], true, true)
      const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')
      textarea.element.setSelectionRange(
        textarea.element.value.length,
        textarea.element.value.length,
      )

      const event = new InputEvent('beforeinput', {
        data: input,
        inputType: 'insertText',
        bubbles: true,
        cancelable: true,
      })
      textarea.element.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(false)
      expect(textarea.element.value).toBe('＃貼り付け')
      wrapper.unmount()
    },
  )

  it('検索ボタンでは検索欄だけを開き、検索欄へフォーカスする', async () => {
    const wrapper = mountInteractiveEditor('one two')

    await wrapper.get<HTMLButtonElement>('.editor-search-button').trigger('click')

    expect(wrapper.get('.search-replace-panel').attributes('role')).toBe('search')
    expect(wrapper.find('#markdown-replace-row').exists()).toBe(false)
    expect(document.activeElement).toBe(
      wrapper.get<HTMLInputElement>('#markdown-search-input').element,
    )
    expect(wrapper.get('.search-result-status').text()).toBe('検索語を入力')
    wrapper.unmount()
  })

  it('置換欄を開いて閉じた後は検索ボタンと検索ショートカットで検索欄だけを開く', async () => {
    const wrapper = mountInteractiveEditor('one two')
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')

    await wrapper.get<HTMLButtonElement>('.editor-search-button').trigger('click')
    await wrapper.get('.search-replace-toggle').trigger('click')
    expect(wrapper.find('#markdown-replace-row').exists()).toBe(true)
    await wrapper.get('.search-close-button').trigger('click')

    await wrapper.get<HTMLButtonElement>('.editor-search-button').trigger('click')
    expect(wrapper.find('#markdown-replace-row').exists()).toBe(false)

    await wrapper.get('.search-replace-toggle').trigger('click')
    await wrapper.get('.search-close-button').trigger('click')

    const shortcutEvent = new KeyboardEvent('keydown', {
      key: 'f',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    textarea.element.dispatchEvent(shortcutEvent)
    await nextTick()

    expect(shortcutEvent.defaultPrevented).toBe(true)
    expect(wrapper.find('#markdown-replace-row').exists()).toBe(false)
    expect(document.activeElement).toBe(
      wrapper.get<HTMLInputElement>('#markdown-search-input').element,
    )
    wrapper.unmount()
  })

  it('検索ショートカットとEnterで一致箇所を前後へ循環移動する', async () => {
    const wrapper = mountInteractiveEditor('one ONE one')
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')
    const shortcutEvent = new KeyboardEvent('keydown', {
      key: 'f',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })

    textarea.element.dispatchEvent(shortcutEvent)
    await nextTick()

    expect(shortcutEvent.defaultPrevented).toBe(true)
    const searchInput = wrapper.get<HTMLInputElement>('#markdown-search-input')
    expect(document.activeElement).toBe(searchInput.element)

    await searchInput.setValue('one')
    expect(wrapper.get('.search-result-status').text()).toBe('1 / 3')
    expect(textarea.element.selectionStart).toBe(0)
    expect(textarea.element.selectionEnd).toBe(3)

    await searchInput.trigger('keydown', { key: 'Enter' })
    expect(wrapper.get('.search-result-status').text()).toBe('2 / 3')
    expect(textarea.element.selectionStart).toBe(4)
    expect(textarea.element.selectionEnd).toBe(7)

    await searchInput.trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(wrapper.get('.search-result-status').text()).toBe('1 / 3')

    await wrapper.get('.search-navigation-button').trigger('click')
    expect(wrapper.get('.search-result-status').text()).toBe('3 / 3')
    wrapper.unmount()
  })

  it('全一致をハイライトし、現在の一致だけを強調する', async () => {
    const wrapper = mountInteractiveEditor('one ONE one')

    await wrapper.get('.editor-search-button').trigger('click')
    const searchInput = wrapper.get<HTMLInputElement>('#markdown-search-input')

    expect(wrapper.find('.search-highlight-layer').exists()).toBe(false)

    await searchInput.setValue('one')

    const highlightLayer = wrapper.get('.search-highlight-layer')
    const highlights = wrapper.findAll('.search-highlight')

    expect(highlightLayer.attributes('aria-hidden')).toBe('true')
    expect(highlightLayer.text()).toBe('one ONE one')
    expect(highlights.map((highlight) => highlight.text())).toEqual([
      'one',
      'ONE',
      'one',
    ])
    expect(highlights[0]!.classes()).toContain('search-highlight--current')
    expect(highlights[1]!.classes()).toContain('search-highlight--match')

    await searchInput.trigger('keydown', { key: 'Enter' })

    const movedHighlights = wrapper.findAll('.search-highlight')
    expect(movedHighlights[0]!.classes()).toContain('search-highlight--match')
    expect(movedHighlights[1]!.classes()).toContain(
      'search-highlight--current',
    )

    await wrapper.get<HTMLTextAreaElement>('#markdown-input').setValue('one only')
    expect(wrapper.findAll('.search-highlight')).toHaveLength(1)
    expect(wrapper.get('.search-highlight-layer').text()).toBe('one only')

    await searchInput.setValue('missing')
    expect(wrapper.find('.search-highlight-layer').exists()).toBe(false)
    wrapper.unmount()
  })

  it('Markdown本文をHTMLとして解釈せずハイライト層へ表示する', async () => {
    const wrapper = mountInteractiveEditor('<img src=x> img')

    await wrapper.get('.editor-search-button').trigger('click')
    await wrapper.get<HTMLInputElement>('#markdown-search-input').setValue('img')

    const highlightLayer = wrapper.get('.search-highlight-layer')
    expect(highlightLayer.text()).toBe('<img src=x> img')
    expect(highlightLayer.find('img').exists()).toBe(false)
    wrapper.unmount()
  })

  it('textareaの縦横スクロール位置をハイライト層へ同期する', async () => {
    const wrapper = mountInteractiveEditor('match '.repeat(100))

    await wrapper.get('.editor-search-button').trigger('click')
    await wrapper.get<HTMLInputElement>('#markdown-search-input').setValue('match')

    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')
    const highlightLayer = wrapper.get<HTMLDivElement>('.search-highlight-layer')
    textarea.element.scrollTop = 84
    textarea.element.scrollLeft = 19
    await textarea.trigger('scroll')

    expect(highlightLayer.element.scrollTop).toBe(84)
    expect(highlightLayer.element.scrollLeft).toBe(19)
    wrapper.unmount()
  })

  it('表示範囲外の現在一致までtextareaをスクロールする', async () => {
    const offsetTopSpy = vi
      .spyOn(HTMLElement.prototype, 'offsetTop', 'get')
      .mockImplementation(function (this: HTMLElement) {
        return this.classList.contains('search-highlight--current') ? 900 : 0
      })
    const offsetHeightSpy = vi
      .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
      .mockImplementation(function (this: HTMLElement) {
        return this.classList.contains('search-highlight--current') ? 24 : 0
      })
    const wrapper = mountInteractiveEditor(
      `${'前の行\n'.repeat(80)}検索対象\n後ろの行`,
    )
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')
    Object.defineProperty(textarea.element, 'clientHeight', {
      configurable: true,
      value: 200,
    })

    await wrapper.get('.editor-search-button').trigger('click')
    await wrapper
      .get<HTMLInputElement>('#markdown-search-input')
      .setValue('検索対象')
    await flushPromises()

    expect(textarea.element.scrollTop).toBe(812)
    expect(
      wrapper.get<HTMLDivElement>('.search-highlight-layer').element.scrollTop,
    ).toBe(812)

    wrapper.unmount()
    offsetTopSpy.mockRestore()
    offsetHeightSpy.mockRestore()
  })

  it('検索欄でIME入力中に一致してもtextareaへフォーカスを移さない', async () => {
    const wrapper = mountInteractiveEditor('tを含む本文')
    await wrapper.get('.editor-search-button').trigger('click')
    const searchInput = wrapper.get<HTMLInputElement>('#markdown-search-input')
    const blur = vi.fn()
    searchInput.element.addEventListener('blur', blur)

    await searchInput.trigger('compositionstart')
    await searchInput.setValue('t')

    expect(wrapper.get('.search-result-status').text()).toBe('1 / 1')
    expect(document.activeElement).toBe(searchInput.element)
    expect(blur).not.toHaveBeenCalled()

    await searchInput.setValue('た')
    await searchInput.trigger('compositionend')

    expect(searchInput.element.value).toBe('た')
    expect(document.activeElement).toBe(searchInput.element)
    wrapper.unmount()
  })

  it('置換ショートカットで置換欄を開き、現在の一致だけを置換する', async () => {
    const wrapper = mountInteractiveEditor('cat cat cat')
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')
    const shortcutEvent = new KeyboardEvent('keydown', {
      key: 'h',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })

    textarea.element.dispatchEvent(shortcutEvent)
    await nextTick()

    expect(shortcutEvent.defaultPrevented).toBe(true)
    await wrapper.get('.search-close-button').trigger('click')

    const commandShortcutEvent = new KeyboardEvent('keydown', {
      key: 'f',
      metaKey: true,
      altKey: true,
      bubbles: true,
      cancelable: true,
    })
    textarea.element.dispatchEvent(commandShortcutEvent)
    await nextTick()

    expect(commandShortcutEvent.defaultPrevented).toBe(true)
    const searchInput = wrapper.get<HTMLInputElement>('#markdown-search-input')
    const replacementInput = wrapper.get<HTMLInputElement>('#markdown-replacement-input')
    expect(document.activeElement).toBe(replacementInput.element)

    await searchInput.setValue('cat')
    await replacementInput.setValue('dog')
    await wrapper.get('.search-action-button').trigger('click')
    await flushPromises()

    expect(textarea.element.value).toBe('dog cat cat')
    expect(wrapper.get('.search-result-status').text()).toBe('1 / 2')
    expect(textarea.element.selectionStart).toBe(4)
    expect(textarea.element.selectionEnd).toBe(7)
    expect(wrapper.get('.replacement-notice').text()).toBe('1件置換しました')
    wrapper.unmount()
  })

  it('すべて置換を1回の本文更新として適用し、件数を表示する', async () => {
    const wrapper = mountInteractiveEditor('x X x')

    await wrapper.get('.editor-search-button').trigger('click')
    await wrapper.get('.search-replace-toggle').trigger('click')
    await wrapper.get<HTMLInputElement>('#markdown-search-input').setValue('x')
    await wrapper.get<HTMLInputElement>('#markdown-replacement-input').setValue('')
    await wrapper.findAll('.search-action-button')[1]!.trigger('click')
    await flushPromises()

    expect(wrapper.get<HTMLTextAreaElement>('#markdown-input').element.value).toBe('  ')
    expect(wrapper.get('.replacement-notice').text()).toBe('3件置換しました')
    expect(wrapper.get('.search-result-status').text()).toBe('一致なし')
    wrapper.unmount()
  })

  it('一致なしでは置換を無効にし、Escapeで本文を変えずに閉じる', async () => {
    const wrapper = mountInteractiveEditor('本文')

    await wrapper.get('.editor-search-button').trigger('click')
    const searchInput = wrapper.get<HTMLInputElement>('#markdown-search-input')
    await searchInput.setValue('なし')
    await wrapper.get('.search-replace-toggle').trigger('click')

    expect(wrapper.get('.search-result-status').text()).toBe('一致なし')
    expect(
      wrapper.findAll<HTMLButtonElement>('.search-action-button').every(
        (button) => button.element.disabled,
      ),
    ).toBe(true)

    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    searchInput.element.dispatchEvent(escapeEvent)
    await nextTick()

    expect(escapeEvent.defaultPrevented).toBe(true)
    expect(wrapper.find('.search-replace-panel').exists()).toBe(false)
    expect(wrapper.get<HTMLTextAreaElement>('#markdown-input').element.value).toBe('本文')
    expect(document.activeElement).toBe(
      wrapper.get<HTMLTextAreaElement>('#markdown-input').element,
    )
    wrapper.unmount()
  })

  it('フッターの入力支援を入力欄の下で開閉し、入力中も表示を維持する', async () => {
    const wrapper = mountInteractiveEditor('')
    const guideButton = wrapper.get<HTMLButtonElement>('.input-guide-button')

    expect(guideButton.text()).toBe('')
    expect(guideButton.attributes('aria-label')).toBe('入力支援を表示')
    expect(guideButton.attributes('title')).toBeUndefined()
    expect(guideButton.attributes('data-tooltip')).toBe('入力支援を表示')
    expect(guideButton.find('[data-icon="help"]').exists()).toBe(true)
    expect(guideButton.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('.character-count').text()).toBe('0文字')
    expect(wrapper.find('.input-guide-panel').exists()).toBe(false)

    await guideButton.trigger('click')

    expect(guideButton.attributes('aria-expanded')).toBe('true')
    expect(guideButton.attributes('aria-label')).toBe('入力支援を閉じる')
    const guidePanel = wrapper.get('.input-guide-panel')
    const textAreaShell = wrapper.get('.text-area-shell')
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')
    expect(guidePanel.attributes('role')).toBe('region')
    expect(textAreaShell.element.nextElementSibling).toBe(guidePanel.element)
    expect(textAreaShell.element.contains(textarea.element)).toBe(true)
    expect(guidePanel.element.nextElementSibling?.classList).toContain('panel-footer')
    expect(wrapper.get('.input-guide-panel .editor-input-guide').text()).toContain(
      'Ctrl / Command + B',
    )
    expect(wrapper.get('.editor-panel').classes()).toContain('editor-panel--guide-open')

    await textarea.trigger('click')
    expect(wrapper.find('.input-guide-panel').exists()).toBe(true)

    await guideButton.trigger('click')
    expect(wrapper.find('.input-guide-panel').exists()).toBe(false)
    expect(guideButton.attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('入力支援をEscapeで閉じてボタンへフォーカスを戻す', async () => {
    const wrapper = mountInteractiveEditor('')
    const guideButton = wrapper.get<HTMLButtonElement>('.input-guide-button')

    await guideButton.trigger('click')
    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    wrapper.get<HTMLTextAreaElement>('#markdown-input').element.dispatchEvent(escapeEvent)
    await nextTick()

    expect(escapeEvent.defaultPrevented).toBe(true)
    expect(wrapper.find('.input-guide-panel').exists()).toBe(false)
    expect(document.activeElement).toBe(guideButton.element)
    wrapper.unmount()
  })

  it('別のUIが処理したEscapeでは入力支援を閉じない', async () => {
    const wrapper = mountInteractiveEditor('')
    const guideButton = wrapper.get<HTMLButtonElement>('.input-guide-button')
    const textarea = wrapper.get<HTMLTextAreaElement>('#markdown-input')

    await guideButton.trigger('click')
    textarea.element.focus()

    const handledEscapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    handledEscapeEvent.preventDefault()
    document.dispatchEvent(handledEscapeEvent)
    await nextTick()

    expect(wrapper.find('.input-guide-panel').exists()).toBe(true)
    expect(document.activeElement).toBe(textarea.element)
    wrapper.unmount()
  })

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
