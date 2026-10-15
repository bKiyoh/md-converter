import { nextTick, onBeforeUnmount, onMounted, watch, type Ref } from 'vue'
import type { MarkdownDocument } from '../types/markdown'
import type { ConversionSourcePosition } from '../types/conversion'
import {
  createScrollAnchors,
  mapScrollPosition,
  type ScrollAnchor,
} from '../utils/scrollMapping'

type ScrollSide = 'editor' | 'output'

type ScrollSyncOptions = {
  editor: Ref<HTMLTextAreaElement | null>
  output: Ref<HTMLElement | null>
  enabled: Ref<boolean>
  source: Ref<string>
  documentKey: Ref<string>
  document: Ref<MarkdownDocument>
  sourceMap?: Ref<readonly ConversionSourcePosition[]>
}

// 実際のtextareaから文字組みを取得し、テーマや幅別CSSとの二重管理を避ける。
const TEXT_LAYOUT_PROPERTIES = [
  'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant',
  'font-stretch', 'line-height', 'letter-spacing', 'word-spacing',
  'text-indent', 'text-transform', 'text-align', 'tab-size', 'white-space',
  'overflow-wrap', 'word-break', 'direction',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
] as const

function measureTextareaLines(
  element: HTMLTextAreaElement,
  source: string,
  requestedLines: ReadonlySet<number>,
): Map<number, number> {
  const positions = new Map<number, number>()
  if (requestedLines.size === 0) {
    return positions
  }
  const mirror = document.createElement('div')
  mirror.className = 'scroll-sync-measure'
  mirror.setAttribute('aria-hidden', 'true')
  mirror.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;box-sizing:border-box;border:0;'
  mirror.style.width = `${element.clientWidth}px`
  const style = window.getComputedStyle(element)
  for (const property of TEXT_LAYOUT_PROPERTIES) {
    mirror.style.setProperty(property, style.getPropertyValue(property))
  }

  const markers = new Map<number, HTMLElement>()
  const fragment = document.createDocumentFragment()
  const lines = source.split(/\r\n|\r|\n/u)
  for (let index = 0; index < lines.length; index += 1) {
    const line = document.createElement('div')
    line.textContent = lines[index] || '\u200b'
    fragment.append(line)
    if (requestedLines.has(index + 1)) {
      markers.set(index + 1, line)
    }
  }
  mirror.append(fragment)
  document.body.append(mirror)

  try {
    const mirrorTop = mirror.getBoundingClientRect().top
    for (const [line, marker] of markers) {
      positions.set(line, marker.getBoundingClientRect().top - mirrorTop)
    }
    return positions
  } finally {
    mirror.remove()
  }
}

function measureAnchors(
  editor: HTMLTextAreaElement,
  output: HTMLElement,
  source: string,
  sourceMap: readonly ConversionSourcePosition[] | undefined,
): ScrollAnchor[] {
  const outputPositions = new Map<number, number>()
  if (output instanceof HTMLTextAreaElement) {
    const validPositions = (sourceMap ?? []).filter(({ sourceLine, outputLine }) =>
      Number.isInteger(sourceLine) && sourceLine > 0 &&
      Number.isInteger(outputLine) && outputLine > 0,
    )
    const lines = measureTextareaLines(output, output.value,
      new Set(validPositions.map(({ outputLine }) => outputLine)))
    for (const { sourceLine, outputLine } of validPositions) {
      const position = lines.get(outputLine)
      if (position !== undefined) {
        outputPositions.set(sourceLine, position)
      }
    }
  } else {
    const outputTop = output.getBoundingClientRect().top + output.clientTop
    for (const element of output.querySelectorAll<HTMLElement>('[data-source-line]')) {
      const line = Number(element.dataset.sourceLine)
      if (Number.isInteger(line) && line > 0) {
        // 同じ行のリスト・引用コンテナより、その内側の本文を目印にする。
        outputPositions.set(line, element.getBoundingClientRect().top - outputTop + output.scrollTop)
      }
    }
  }
  const editorPositions = measureTextareaLines(editor, source, new Set(outputPositions.keys()))
  const positions: ScrollAnchor[] = []
  for (const [line, outputPosition] of outputPositions) {
    const editorPosition = editorPositions.get(line)
    if (editorPosition !== undefined) {
      positions.push({ editor: editorPosition, output: outputPosition })
    }
  }
  if (positions.length === 0) {
    return []
  }
  return createScrollAnchors(positions,
    editor.scrollHeight - editor.clientHeight,
    output.scrollHeight - output.clientHeight)
}

export function useScrollSync(options: ScrollSyncOptions): void {
  let anchors: ScrollAnchor[] | null = null
  let frame: number | null = null
  let generation = 0
  let disposed = false
  let resetting = false
  let cleanupElements: (() => void) | undefined
  const expectedPositions = new Map<HTMLElement, number>()

  function isAvailable(): boolean {
    const editor = options.editor.value
    const output = options.output.value
    return options.enabled.value && window.innerWidth >= 768 &&
      editor !== null && output !== null &&
      editor.clientWidth > 0 && editor.clientHeight > 0 &&
      output.clientWidth > 0 && output.clientHeight > 0
  }

  function cancelFrame(): void {
    if (frame !== null) {
      window.cancelAnimationFrame(frame)
      frame = null
    }
  }

  function synchronize(side: ScrollSide): void {
    if (!isAvailable()) {
      return
    }
    const editor = options.editor.value!
    const output = options.output.value!
    const source = side === 'editor' ? editor : output
    const target = side === 'editor' ? output : editor
    if (source.scrollHeight <= source.clientHeight || target.scrollHeight <= target.clientHeight) {
      return
    }
    anchors ??= measureAnchors(editor, output, options.source.value, options.sourceMap?.value)
    if (anchors.length < 2) {
      return
    }
    const targetTop = mapScrollPosition(anchors, side, source.scrollTop)
    if (Math.abs(target.scrollTop - targetTop) < 0.5) {
      return
    }
    target.scrollTop = targetTop
    // ブラウザが丸めた実際の位置を記録し、後から届くscrollの反響だけを止める。
    expectedPositions.set(target, target.scrollTop)
  }

  function scheduleSync(side: ScrollSide): void {
    cancelFrame()
    if (!isAvailable()) {
      return
    }
    frame = window.requestAnimationFrame(() => {
      frame = null
      synchronize(side)
      resetting = false
    })
  }

  function handleScroll(side: ScrollSide, element: HTMLElement): void {
    // DOM更新によるブラウザの位置補正を、利用者の逆方向操作として扱わない。
    if (resetting) {
      return
    }
    const expected = expectedPositions.get(element)
    expectedPositions.delete(element)
    if (expected !== undefined && Math.abs(element.scrollTop - expected) < 1) {
      return
    }
    scheduleSync(side)
  }

  function invalidate(): void {
    resetting = true
    anchors = null
    expectedPositions.clear()
    cancelFrame()
    const currentGeneration = ++generation
    // フォーカスモードの位置復元と、デバウンス後のプレビュー描画を先に完了させる。
    void nextTick(() => {
      if (!disposed && currentGeneration === generation) {
        scheduleSync('editor')
      }
    })
  }

  watch(
    [options.editor, options.output],
    ([editor, output]) => {
      cleanupElements?.()
      const cleanups: (() => void)[] = []
      const observer = typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(invalidate)
      for (const [side, element] of [['editor', editor], ['output', output]] as const) {
        if (!element) {
          continue
        }
        const onScroll = (): void => handleScroll(side, element)
        const onInteraction = (): void => {
          expectedPositions.delete(element)
          if (!resetting) {
            cancelFrame()
          }
        }
        element.addEventListener('scroll', onScroll, { passive: true })
        for (const event of ['wheel', 'pointerdown', 'keydown', 'touchstart']) {
          element.addEventListener(event, onInteraction, { passive: true })
        }
        observer?.observe(element)
        cleanups.push(() => {
          element.removeEventListener('scroll', onScroll)
          for (const event of ['wheel', 'pointerdown', 'keydown', 'touchstart']) {
            element.removeEventListener(event, onInteraction)
          }
        })
      }
      cleanupElements = (): void => {
        observer?.disconnect()
        cleanups.forEach((cleanup) => cleanup())
      }
      invalidate()
    },
    { immediate: true, flush: 'post' },
  )

  watch(
    [options.enabled, options.source, options.documentKey, options.document, () => options.sourceMap?.value],
    invalidate,
    { flush: 'sync' },
  )

  onMounted(() => {
    window.addEventListener('resize', invalidate)
    document.fonts?.addEventListener('loadingdone', invalidate)
    document.fonts?.addEventListener('loadingerror', invalidate)
  })

  onBeforeUnmount(() => {
    disposed = true
    generation += 1
    cancelFrame()
    cleanupElements?.()
    expectedPositions.clear()
    window.removeEventListener('resize', invalidate)
    document.fonts?.removeEventListener('loadingdone', invalidate)
    document.fonts?.removeEventListener('loadingerror', invalidate)
  })
}
