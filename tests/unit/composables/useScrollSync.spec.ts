import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, type Ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useScrollSync } from '../../../src/composables/useScrollSync'
import type { MarkdownDocument } from '../../../src/types/markdown'

type Layout = {
  editorWidth: number
  editorHeight: number
  editorScrollHeight: number
  outputWidth: number
  outputHeight: number
  outputScrollHeight: number
  editorLines: number[]
  outputLines: Map<number, number>
}

type Harness = {
  editor: HTMLTextAreaElement
  output: HTMLElement
  enabled: Ref<boolean>
  source: Ref<string>
  documentKey: Ref<string>
  parsedDocument: Ref<MarkdownDocument>
  layout: Layout
}

let wrapper: VueWrapper | null = null
let frameId: number = 0
let frames: Map<number, FrameRequestCallback>
let observers: MockResizeObserver[]

class MockResizeObserver {
  readonly callback: ResizeObserverCallback
  disconnected: boolean = false

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    observers.push(this)
  }

  observe(): void {}
  unobserve(): void {}
  disconnect(): void { this.disconnected = true }

  resize(): void {
    if (!this.disconnected) this.callback([], this)
  }
}

beforeEach(() => {
  frames = new Map()
  observers = []
  vi.stubGlobal('innerWidth', 1280)
  vi.stubGlobal('ResizeObserver', MockResizeObserver)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
    const id: number = ++frameId
    frames.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number): void => { frames.delete(id) })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

async function flushSync(): Promise<void> {
  await nextTick()
  await nextTick()
  const pending: FrameRequestCallback[] = [...frames.values()]
  frames.clear()
  pending.forEach((callback) => callback(0))
}

function scroll(element: HTMLElement, top: number): void {
  element.scrollTop = top
  element.dispatchEvent(new Event('scroll'))
}

async function createHarness(initialEnabled: boolean = true): Promise<Harness> {
  const editorRef: Ref<HTMLTextAreaElement | null> = ref(null)
  const outputRef: Ref<HTMLElement | null> = ref(null)
  const enabled: Ref<boolean> = ref(initialEnabled)
  const source: Ref<string> = ref('# 見出し\n\n日本語の本文\n\n末尾')
  const documentKey: Ref<string> = ref('tab-1')
  const parsedDocument: Ref<MarkdownDocument> = ref({ blocks: [] })
  const layout: Layout = {
    editorWidth: 400,
    editorHeight: 100,
    editorScrollHeight: 600,
    outputWidth: 500,
    outputHeight: 100,
    outputScrollHeight: 800,
    editorLines: [0, 20, 100, 120, 300],
    outputLines: new Map([[1, 0], [3, 200], [5, 300]]),
  }

  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ): DOMRect {
    let top: number = 0
    if (this === outputRef.value) {
      top = 100
    } else if (this.dataset.sourceLine && this.parentElement === outputRef.value) {
      top = 102 + (layout.outputLines.get(Number(this.dataset.sourceLine)) ?? 0)
        - (outputRef.value?.scrollTop ?? 0)
    } else if (this.parentElement?.classList.contains('scroll-sync-measure')) {
      const index: number = Array.from(this.parentElement.children).indexOf(this)
      top = layout.editorLines[index] ?? index * 20
    }
    return new DOMRect(0, top, 400, 20)
  })

  wrapper = mount(defineComponent({
    setup() {
      useScrollSync({
        editor: editorRef,
        output: outputRef,
        enabled,
        source,
        documentKey,
        document: parsedDocument,
      })
      return () => h('div', [
        h('textarea', { ref: editorRef, value: source.value }),
        h('div', { ref: outputRef }, [1, 3, 5].map((line) =>
          h('p', { 'data-source-line': line }, `本文 ${line}`))),
      ])
    },
  }), { attachTo: document.body })

  const editor: HTMLTextAreaElement = editorRef.value!
  const output: HTMLElement = outputRef.value!
  Object.defineProperties(editor, {
    clientWidth: { get: () => layout.editorWidth },
    clientHeight: { get: () => layout.editorHeight },
    scrollHeight: { get: () => layout.editorScrollHeight },
  })
  Object.defineProperties(output, {
    clientWidth: { get: () => layout.outputWidth },
    clientHeight: { get: () => layout.outputHeight },
    scrollHeight: { get: () => layout.outputScrollHeight },
    clientTop: { value: 2 },
  })
  await flushSync()
  return { editor, output, enabled, source, documentKey, parsedDocument, layout }
}

describe('useScrollSync', () => {
  it('高さの異なるブロックの対応位置で両方向に同期し、先頭と末尾を揃える', async () => {
    const { editor, output } = await createHarness()

    scroll(editor, 100)
    await flushSync()
    expect(output.scrollTop).toBe(200)

    scroll(output, 250)
    await flushSync()
    expect(editor.scrollTop).toBe(200)

    scroll(editor, 500)
    await flushSync()
    expect(output.scrollTop).toBe(700)

    scroll(output, 0)
    await flushSync()
    expect(editor.scrollTop).toBe(0)
  })

  it('同期によって本文・選択範囲・フォーカス・横スクロールを変更しない', async () => {
    const { editor, output, source } = await createHarness()
    editor.focus()
    editor.setSelectionRange(2, 5, 'backward')
    editor.scrollLeft = 25
    output.scrollLeft = 40

    scroll(output, 250)
    await flushSync()

    expect(editor.scrollTop).toBe(200)
    expect(editor.value).toBe(source.value)
    expect([editor.selectionStart, editor.selectionEnd, editor.selectionDirection])
      .toEqual([2, 5, 'backward'])
    expect(document.activeElement).toBe(editor)
    expect(editor.scrollLeft).toBe(25)
    expect(output.scrollLeft).toBe(40)
  })

  it('ブラウザが追従位置を丸めても反響イベントで元の位置を動かさない', async () => {
    const { editor, output } = await createHarness()
    let editorTop: number = 0
    let outputTop: number = 0
    Object.defineProperty(editor, 'scrollTop', {
      configurable: true,
      get: () => editorTop,
      set: (value: number) => { editorTop = value },
    })
    Object.defineProperty(output, 'scrollTop', {
      configurable: true,
      get: () => outputTop,
      set: (value: number) => { outputTop = Math.round(value) },
    })

    scroll(editor, 50.3)
    await flushSync()
    expect(output.scrollTop).toBe(101)
    output.dispatchEvent(new Event('scroll'))
    await flushSync()
    expect(editor.scrollTop).toBe(50.3)

    scroll(output, 250)
    await flushSync()
    expect(editor.scrollTop).toBe(200)
    editor.dispatchEvent(new Event('scroll'))
    await flushSync()
    expect(output.scrollTop).toBe(250)
  })

  it('操作する領域が切り替わった場合は古い追従より新しい操作を優先する', async () => {
    const { editor, output } = await createHarness()
    scroll(output, 500)
    editor.dispatchEvent(new Event('wheel'))
    scroll(editor, 150)
    await flushSync()

    expect(editor.scrollTop).toBe(150)
    expect(output.scrollTop).toBe(225)
  })

  it('無効中は同期せず、再有効化するとエディター位置から同期する', async () => {
    const { editor, output, enabled } = await createHarness(false)
    scroll(editor, 100)
    await flushSync()
    expect(output.scrollTop).toBe(0)

    enabled.value = true
    await flushSync()
    expect(output.scrollTop).toBe(200)

    scroll(output, 500)
    enabled.value = false
    await flushSync()
    expect(editor.scrollTop).toBe(100)
  })

  it('767px以下では同期せず、768pxに戻るとエディター位置から同期する', async () => {
    vi.stubGlobal('innerWidth', 767)
    const { editor, output } = await createHarness()
    scroll(editor, 100)
    await flushSync()
    expect(output.scrollTop).toBe(0)

    vi.stubGlobal('innerWidth', 768)
    window.dispatchEvent(new Event('resize'))
    await flushSync()
    expect(output.scrollTop).toBe(200)
  })

  it.each(['editorWidth', 'editorHeight', 'outputWidth', 'outputHeight'] as const)(
    '%sが0の非表示領域とは同期しない',
    async (property) => {
      const { editor, output, layout } = await createHarness()
      layout[property] = 0
      scroll(editor, 100)
      await flushSync()
      expect(output.scrollTop).toBe(0)

      scroll(output, 250)
      await flushSync()
      expect(editor.scrollTop).toBe(100)
    },
  )

  it.each(['editorScrollHeight', 'outputScrollHeight'] as const)(
    '%sが表示領域内に収まる場合は相手の位置を戻さない',
    async (property) => {
      const { editor, output, layout } = await createHarness()
      layout[property] = 100
      editor.scrollTop = 100
      output.scrollTop = 250
      const short: HTMLElement = property === 'editorScrollHeight' ? editor : output
      const long: HTMLElement = short === editor ? output : editor
      short.scrollTop = 0
      const originalTop: number = long.scrollTop
      short.dispatchEvent(new Event('scroll'))
      await flushSync()
      expect(long.scrollTop).toBe(originalTop)

      scroll(long, originalTop + 10)
      await flushSync()
      expect(short.scrollTop).toBe(0)
    },
  )

  it.each(['source', 'documentKey', 'parsedDocument'] as const)(
    '%sの更新で古い追従を破棄し、対応位置を再計測する',
    async (property) => {
      const harness: Harness = await createHarness()
      const { editor, output, layout } = harness
      scroll(editor, 100)
      await flushSync()
      expect(output.scrollTop).toBe(200)

      scroll(output, 500)
      layout.outputLines.set(3, 250)
      if (property === 'parsedDocument') {
        harness.parsedDocument.value = { blocks: [] }
      } else {
        harness[property].value += '更新'
      }
      await flushSync()

      expect(editor.scrollTop).toBe(100)
      expect(output.scrollTop).toBe(250)
    },
  )

  it('解析待ちの本文変更では同期せず、解析結果の描画後に同期を再開する', async () => {
    const { editor, output, enabled, source, parsedDocument, layout } = await createHarness()
    scroll(editor, 100)
    await flushSync()
    enabled.value = false
    source.value += '\n更新した本文'
    layout.outputLines.set(3, 250)
    scroll(editor, 200)
    await flushSync()
    expect(output.scrollTop).toBe(200)

    parsedDocument.value = { blocks: [] }
    enabled.value = true
    await flushSync()
    expect(output.scrollTop).toBe(275)
  })

  it('描画更新に伴うプレビューの位置調整よりエディター位置からの再同期を優先する', async () => {
    const { editor, output, parsedDocument, layout } = await createHarness()
    scroll(editor, 100)
    await flushSync()
    layout.outputLines.set(3, 250)
    parsedDocument.value = { blocks: [] }
    await nextTick()
    await nextTick()

    scroll(output, 500)
    output.dispatchEvent(new Event('wheel'))
    await flushSync()

    expect(editor.scrollTop).toBe(100)
    expect(output.scrollTop).toBe(250)
  })

  it.each(['window', 'element'] as const)('%sのリサイズ後は折り返し位置を再計測する', async (kind) => {
    const { editor, output, layout } = await createHarness()
    scroll(editor, 100)
    await flushSync()
    expect(output.scrollTop).toBe(200)

    layout.editorWidth = 200
    layout.editorLines = [0, 40, 200, 240, 400]
    if (kind === 'window') window.dispatchEvent(new Event('resize'))
    else observers.forEach((observer) => observer.resize())
    await flushSync()

    expect(editor.scrollTop).toBe(100)
    expect(output.scrollTop).toBe(100)
    expect(document.querySelector('.scroll-sync-measure')).toBeNull()
  })

  it.each(['loadingdone', 'loadingerror'])(
    'フォントの%s後は原文位置から再計測・同期し、破棄時に監視を解除する', async (eventName) => {
      const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts')
      const fonts = new EventTarget()
      const removeListener = vi.spyOn(fonts, 'removeEventListener')
      Object.defineProperty(document, 'fonts', { configurable: true, value: fonts })
      try {
        const { editor, output, layout } = await createHarness()
        scroll(editor, 100)
        await flushSync()
        expect(output.scrollTop).toBe(200)
        layout.editorLines = [0, 40, 200, 240, 400]
        fonts.dispatchEvent(new Event(eventName))
        await flushSync()
        expect(editor.scrollTop).toBe(100)
        expect(output.scrollTop).toBe(100)
        wrapper!.unmount()
        wrapper = null
        expect(removeListener).toHaveBeenCalledWith(eventName, expect.any(Function))
        fonts.dispatchEvent(new Event(eventName))
        expect(frames.size).toBe(0)
      } finally {
        if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts)
        else Reflect.deleteProperty(document, 'fonts')
      }
    },
  )

  it('空のプレビューに対応点がない場合は位置を動かさない', async () => {
    const { editor, output, parsedDocument } = await createHarness()
    output.replaceChildren()
    parsedDocument.value = { blocks: [] }
    scroll(editor, 100)
    await flushSync()
    expect(output.scrollTop).toBe(0)
  })

  it('破棄時に保留中の同期と監視を解除し、古い領域の操作へ反応しない', async () => {
    const { editor, output, source } = await createHarness()
    scroll(editor, 100)
    source.value += '\n更新'
    wrapper!.unmount()
    wrapper = null
    await flushSync()
    expect(output.scrollTop).toBe(0)
    expect(observers.every((observer) => observer.disconnected)).toBe(true)

    scroll(editor, 300)
    window.dispatchEvent(new Event('resize'))
    await flushSync()
    expect(output.scrollTop).toBe(0)
    expect(document.querySelector('.scroll-sync-measure')).toBeNull()
  })
})
