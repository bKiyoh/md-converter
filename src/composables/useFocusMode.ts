import { nextTick, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import type { MarkdownEditorViewState } from '../types/editorView'

export type MarkdownEditorController = {
  captureViewState: () => MarkdownEditorViewState | null
  restoreViewState: (state: MarkdownEditorViewState) => void
  isConnected: () => boolean
  openSearch: (showReplace?: boolean) => Promise<void>
}

export type UseFocusModeResult = {
  isFocusMode: Ref<boolean>
  isFocusPreview: Ref<boolean>
  toggleFocusPreview: () => Promise<void>
  isFocusModeHelpOpen: Ref<boolean>
  enterFocusMode: () => Promise<void>
  exitFocusMode: () => Promise<void>
  toggleFocusModeHelp: () => void
}

export function useFocusMode(
  markdownEditor: Ref<MarkdownEditorController | null>,
  showInputPanel: () => void,
  previewElement: Ref<HTMLElement | null>,
): UseFocusModeResult {
  const isFocusMode = ref<boolean>(false)
  const isFocusModeHelpOpen = ref<boolean>(false)
  const isFocusPreview = ref<boolean>(false)
  let editorViewState: MarkdownEditorViewState | null = null
  let previewScrollTop = 0
  let previewScrollLeft = 0
  let transition = 0

  async function toggleFocusPreview(): Promise<void> {
    if (!isFocusMode.value) return

    // 待機中の古い切り替えによるフォーカス復元を防ぐ。
    const currentTransition = ++transition
    if (isFocusPreview.value) {
      previewScrollTop = previewElement.value?.scrollTop ?? 0
      previewScrollLeft = previewElement.value?.scrollLeft ?? 0
      isFocusPreview.value = false
      await nextTick()
      if (currentTransition === transition && editorViewState) {
        markdownEditor.value?.restoreViewState(editorViewState)
      }
    } else {
      editorViewState = markdownEditor.value?.captureViewState() ?? null
      isFocusPreview.value = true
      await nextTick()
      if (currentTransition === transition) {
        previewElement.value?.focus({ preventScroll: true })
        if (previewElement.value) {
          previewElement.value.scrollTop = previewScrollTop
          previewElement.value.scrollLeft = previewScrollLeft
        }
      }
    }
  }

  async function switchMode(enabled: boolean): Promise<void> {
    const currentTransition = ++transition
    const viewState = isFocusPreview.value
      ? editorViewState
      : markdownEditor.value?.captureViewState() ?? null
    isFocusPreview.value = false
    previewScrollTop = 0
    previewScrollLeft = 0
    showInputPanel()
    isFocusModeHelpOpen.value = false
    isFocusMode.value = enabled
    await nextTick()

    if (currentTransition === transition && viewState) {
      markdownEditor.value?.restoreViewState(viewState)
    }
  }

  async function enterFocusMode(): Promise<void> {
    await switchMode(true)
  }

  async function exitFocusMode(): Promise<void> {
    if (!isFocusMode.value) {
      return
    }

    await switchMode(false)
  }

  function toggleFocusModeHelp(): void {
    isFocusModeHelpOpen.value = !isFocusModeHelpOpen.value
  }

  function handleDocumentKeydown(event: KeyboardEvent): void {
    if (event.isComposing || event.keyCode === 229 || event.defaultPrevented || !markdownEditor.value?.isConnected()) {
      return
    }

    if (
      isFocusMode.value && event.key === 'Enter' &&
      (event.ctrlKey !== event.metaKey) && !event.shiftKey && !event.altKey
    ) {
      event.preventDefault()
      if (!event.repeat) void toggleFocusPreview()
      return
    }

    if (
      event.key !== 'Escape' || event.shiftKey || event.altKey ||
      event.ctrlKey || event.metaKey || event.repeat
    ) return

    queueMicrotask(() => {
      if (event.defaultPrevented || !markdownEditor.value?.isConnected()) {
        return
      }

      event.preventDefault()

      if (isFocusMode.value) {
        void exitFocusMode()
      } else {
        void enterFocusMode()
      }
    })
  }

  onMounted(() => {
    document.addEventListener('keydown', handleDocumentKeydown)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleDocumentKeydown)
  })

  return {
    isFocusMode,
    isFocusPreview,
    toggleFocusPreview,
    isFocusModeHelpOpen,
    enterFocusMode,
    exitFocusMode,
    toggleFocusModeHelp,
  }
}
