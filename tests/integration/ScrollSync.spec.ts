import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App.vue'
import { LEGACY_MARKDOWN_DRAFT_STORAGE_KEY } from '../../src/composables/useEditorStorage'
import { CONVERSION_DEBOUNCE_DELAY_MS } from '../../src/utils/conversionTiming'
import { OUTPUT_FORMATS, type OutputFormat } from '../../src/types/conversion'

const markdown = '# 見出し\n\n最初の段落\n\n**中間の段落**\n\n最後の段落'

describe('Appのスクロール同期', () => {
  let wrapper: VueWrapper | undefined
  let frames: Map<number, FrameRequestCallback>
  let frameId: number
  let originalWidth: PropertyDescriptor | undefined

  function setWindowWidth(width: number): void {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
    window.dispatchEvent(new Event('resize'))
  }

  function isScrollSurface(element: HTMLElement): boolean {
    return ['markdown-input', 'markdown-preview', 'conversion-output'].includes(element.id)
  }

  function rect(top: number): DOMRect {
    return { x: 0, y: top, top, left: 0, bottom: top + 20, right: 400, width: 400, height: 20, toJSON: () => ({}) }
  }

  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(LEGACY_MARKDOWN_DRAFT_STORAGE_KEY, markdown)
    vi.useFakeTimers()
    originalWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth')
    setWindowWidth(1200)
    frames = new Map()
    frameId = 0
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.set(++frameId, callback)
      return frameId
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => { frames.delete(id) })

    // jsdomのレイアウトだけを補い、Appから実際の同期処理までを通す。
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return isScrollSurface(this) ? 100 : 0
    })
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      if (this.id === 'conversion-output') return 500
      return isScrollSurface(this) ? 400 : 0
    })
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      if (this.id === 'markdown-input') return 600
      if (this.id === 'markdown-preview') return 1100
      if (this.id === 'conversion-output') return 1500
      return 0
    })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.parentElement?.classList.contains('scroll-sync-measure')) {
        const lineHeight = this.parentElement.style.width === '500px' ? 40 : 20
        return rect(Array.from(this.parentElement.children).indexOf(this) * lineHeight)
      }
      if (this.dataset.sourceLine) {
        const preview = this.closest<HTMLElement>('#markdown-preview')
        return rect((Number(this.dataset.sourceLine) - 1) * 60 - (preview?.scrollTop ?? 0))
      }
      return rect(0)
    })
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
    if (originalWidth) Object.defineProperty(window, 'innerWidth', originalWidth)
    document.body.replaceChildren()
  })

  async function flushFrames(): Promise<void> {
    await nextTick()
    await nextTick()
    for (let count = 0; frames.size > 0 && count < 5; count += 1) {
      const callbacks = Array.from(frames.values())
      frames.clear()
      callbacks.forEach((callback) => callback(0))
      await nextTick()
    }
    expect(frames.size).toBe(0)
  }

  async function mountPreview(): Promise<{
    app: VueWrapper
    editor: HTMLTextAreaElement
    preview: HTMLElement
  }> {
    wrapper = mount(App, { attachTo: document.body })
    await wrapper.get('#preview-view-tab').trigger('click')
    await flushFrames()
    return {
      app: wrapper,
      editor: wrapper.get<HTMLTextAreaElement>('#markdown-input').element,
      preview: wrapper.get<HTMLElement>('#markdown-preview').element,
    }
  }

  async function scroll(element: HTMLElement, top: number): Promise<void> {
    element.scrollTop = top
    element.dispatchEvent(new Event('scroll'))
    await flushFrames()
  }

  async function mountConversion(format: OutputFormat = 'backlog-notation'): Promise<{
    app: VueWrapper
    editor: HTMLTextAreaElement
    output: HTMLTextAreaElement
  }> {
    wrapper = mount(App, { attachTo: document.body })
    await wrapper.get('#output-format').setValue(format)
    await flushFrames()
    return {
      app: wrapper,
      editor: wrapper.get<HTMLTextAreaElement>('#markdown-input').element,
      output: wrapper.get<HTMLTextAreaElement>('#conversion-output').element,
    }
  }

  it.each(['preview', 'conversion'] as const)('%sとの同期をアイコントグルで即時停止・再開できる', async (view) => {
    const pane = view === 'preview' ? await mountPreview() : await mountConversion()
    const { app, editor } = pane
    const surface = 'preview' in pane ? pane.preview : pane.output
    const toggle = app.get<HTMLButtonElement>('#scroll-sync-setting')
    expect(toggle.attributes('aria-pressed')).toBe('true')
    await scroll(editor, 80)
    expect(surface.scrollTop).toBe(view === 'preview' ? 240 : 160)
    editor.scrollTop = 120
    editor.dispatchEvent(new Event('scroll'))
    await toggle.trigger('click')
    await flushFrames()
    expect(surface.scrollTop).toBe(view === 'preview' ? 240 : 160)
    await scroll(surface, 400)
    expect(editor.scrollTop).toBe(120)
    await toggle.trigger('click')
    await flushFrames()
    expect(editor.scrollTop).toBe(120)
    expect(surface.scrollTop).toBe(view === 'preview' ? 360 : 240)
  })

  it.each(OUTPUT_FORMATS)('%sの変換結果とも開始行と折り返し位置で双方向に同期する', async (format) => {
    const { editor, output } = await mountConversion(format)
    const outputTop = format === 'plain-text' ? 120 : 160
    const original = output.value
    output.focus()
    output.setSelectionRange(1, 3, 'backward')
    editor.setSelectionRange(2, 6, 'backward')
    output.scrollLeft = 13

    await scroll(editor, 80)
    expect(output.scrollTop).toBe(outputTop)
    await scroll(output, format === 'plain-text' ? 200 : 240)
    expect(editor.scrollTop).toBe(120)
    expect(output.value).toBe(original)
    expect([output.selectionStart, output.selectionEnd, output.selectionDirection]).toEqual([1, 3, 'backward'])
    expect([editor.selectionStart, editor.selectionEnd, editor.selectionDirection]).toEqual([2, 6, 'backward'])
    expect(document.activeElement).toBe(output)
    expect(output.scrollLeft).toBe(13)

    await scroll(editor, 500)
    expect(output.scrollTop).toBe(1400)
    await scroll(output, 0)
    expect(editor.scrollTop).toBe(0)
  })

  it('形式変更後は同じtextareaを保持し、新しい出力行へ合わせ直す', async () => {
    const { app, editor, output } = await mountConversion()
    await scroll(editor, 80)
    expect(output.scrollTop).toBe(160)
    await app.get('#output-format').setValue('plain-text')
    await flushFrames()
    expect(app.get('#conversion-output').element).toBe(output)
    expect(editor.scrollTop).toBe(80)
    expect(output.scrollTop).toBe(120)
    await app.get('#output-format').setValue('slack')
    await flushFrames()
    expect(editor.scrollTop).toBe(80)
    expect(output.scrollTop).toBe(160)
  })

  it('変換結果の解析待ち中は両方向の同期を止め、描画更新後に再開する', async () => {
    const { app, editor, output } = await mountConversion()
    await scroll(editor, 80)
    await app.get('#markdown-input').setValue(`${markdown}\n\n追加`)
    await scroll(output, 240)
    expect(editor.scrollTop).toBe(80)
    await scroll(editor, 120)
    await vi.advanceTimersByTimeAsync(CONVERSION_DEBOUNCE_DELAY_MS - 1)
    await flushFrames()
    expect(output.scrollTop).toBe(240)
    expect(output.value).not.toContain('追加')
    await vi.advanceTimersByTimeAsync(1)
    await flushFrames()
    expect(output.value).toContain('追加')
    expect(editor.scrollTop).toBe(120)
    expect(output.scrollTop).toBe(240)
  })

  it.each(['focus', 'internal-scroll', 'mobile'] as const)(
    '%sでは変換結果との同期も停止し、復帰時はエディターを優先する',
    async (condition) => {
      const { app, editor, output } = await mountConversion()
      await scroll(editor, 80)
      if (condition === 'focus') {
        await app.get('.focus-mode-button').trigger('click')
      } else if (condition === 'internal-scroll') {
        await app.get('.settings-button').trigger('click')
        await app.get<HTMLInputElement>('#editor-scroll-setting').setValue(false)
      } else {
        setWindowWidth(767)
      }
      await scroll(editor, 120)
      expect(output.scrollTop).toBe(160)
      await scroll(output, 400)
      expect(editor.scrollTop).toBe(120)

      if (condition === 'focus') {
        await app.get('.focus-mode-exit-button').trigger('click')
      } else if (condition === 'internal-scroll') {
        await app.get<HTMLInputElement>('#editor-scroll-setting').setValue(true)
      } else {
        setWindowWidth(768)
      }
      await flushFrames()
      expect(editor.scrollTop).toBe(120)
      expect(output.scrollTop).toBe(240)
    },
  )

  it('実際の原文行を使って双方向へ追従し、本文・選択範囲・フォーカス・横位置を維持する', async () => {
    const { editor, preview } = await mountPreview()
    editor.focus()
    editor.setSelectionRange(2, 6, 'backward')
    editor.scrollLeft = 17
    preview.scrollLeft = 19

    await scroll(editor, 80)
    expect(preview.scrollTop).toBe(240)

    await scroll(preview, 360)
    expect(editor.scrollTop).toBe(120)

    editor.dispatchEvent(new Event('scroll'))
    await flushFrames()
    expect(preview.scrollTop).toBe(360)
    expect(editor.value).toBe(markdown)
    expect(editor.selectionStart).toBe(2)
    expect(editor.selectionEnd).toBe(6)
    expect(editor.selectionDirection).toBe('backward')
    expect(document.activeElement).toBe(editor)
    expect(editor.scrollLeft).toBe(17)
    expect(preview.scrollLeft).toBe(19)
  })

  it('タブ切り替えで表示中の領域だけと同期し、プレビューの再作成後も合わせ直す', async () => {
    const { app, editor, preview } = await mountPreview()
    await scroll(editor, 80)

    await app.get('#conversion-view-tab').trigger('click')
    await scroll(editor, 120)
    expect(app.get<HTMLTextAreaElement>('#conversion-output').element.scrollTop).toBe(240)
    expect(preview.scrollTop).toBe(240)
    expect(app.find('#markdown-preview').exists()).toBe(false)

    await scroll(preview, 600)
    expect(editor.scrollTop).toBe(120)

    await app.get('#preview-view-tab').trigger('click')
    await flushFrames()
    const recreatedPreview = app.get<HTMLElement>('#markdown-preview').element
    expect(recreatedPreview).not.toBe(preview)
    expect(recreatedPreview.scrollTop).toBe(360)
    expect(editor.scrollTop).toBe(120)
  })

  it('入力後150msの解析待ちでは停止し、更新されたプレビューをエディターへ再同期する', async () => {
    const { app, editor, preview } = await mountPreview()
    await scroll(editor, 80)

    await app.get<HTMLTextAreaElement>('#markdown-input').setValue(`${markdown}\n\n更新した段落`)
    await scroll(editor, 120)
    await vi.advanceTimersByTimeAsync(CONVERSION_DEBOUNCE_DELAY_MS - 1)
    await flushFrames()
    expect(preview.scrollTop).toBe(240)
    expect(preview.textContent).not.toContain('更新した段落')

    await vi.advanceTimersByTimeAsync(1)
    await flushFrames()
    expect(preview.textContent).toContain('更新した段落')
    expect(preview.scrollTop).toBe(360)
    expect(editor.scrollTop).toBe(120)
  })

  it('フォーカスモードでは停止し、終了時は復元されたエディター位置へ追従する', async () => {
    const { app, editor, preview } = await mountPreview()
    await scroll(editor, 80)
    editor.setSelectionRange(2, 6)

    await app.get('.focus-mode-button').trigger('click')
    await scroll(editor, 120)
    expect(preview.scrollTop).toBe(240)
    await scroll(preview, 600)
    expect(editor.scrollTop).toBe(120)

    await app.get('.focus-mode-exit-button').trigger('click')
    await flushFrames()
    expect(app.get<HTMLTextAreaElement>('#markdown-input').element).toBe(editor)
    expect(editor.scrollTop).toBe(120)
    expect(preview.scrollTop).toBe(360)
    expect(editor.selectionStart).toBe(2)
    expect(editor.selectionEnd).toBe(6)
    expect(document.activeElement).toBe(editor)
  })

  it('内部スクロールOFFでは停止し、ONへ戻すとエディター位置から再開する', async () => {
    const { app, editor, preview } = await mountPreview()
    await scroll(editor, 80)
    await app.get('.settings-button').trigger('click')
    await app.get<HTMLInputElement>('#editor-scroll-setting').setValue(false)

    await scroll(editor, 120)
    expect(preview.scrollTop).toBe(240)
    await scroll(preview, 600)
    expect(editor.scrollTop).toBe(120)

    await app.get<HTMLInputElement>('#editor-scroll-setting').setValue(true)
    await flushFrames()
    expect(preview.scrollTop).toBe(360)
  })

  it('767px以下では停止し、768pxへ戻すとエディター位置から再開する', async () => {
    const { editor, preview } = await mountPreview()
    await scroll(editor, 80)
    setWindowWidth(767)

    await scroll(editor, 120)
    expect(preview.scrollTop).toBe(240)
    await scroll(preview, 600)
    expect(editor.scrollTop).toBe(120)

    setWindowWidth(768)
    await flushFrames()
    expect(preview.scrollTop).toBe(360)
    expect(editor.scrollTop).toBe(120)
  })
})
