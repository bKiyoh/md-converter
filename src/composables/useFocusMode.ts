import { nextTick, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import type { MarkdownEditorViewState } from '../types/editorView'

export type MarkdownEditorController = {
  captureViewState: () => MarkdownEditorViewState | null
  restoreViewState: (state: MarkdownEditorViewState) => void
  isConnected: () => boolean
}

export type UseFocusModeResult = {
  isFocusMode: Ref<boolean>
  isFocusModeHelpOpen: Ref<boolean>
  enterFocusMode: () => Promise<void>
  exitFocusMode: () => Promise<void>
  toggleFocusModeHelp: () => void
}

export function useFocusMode(
  markdownEditor: Ref<MarkdownEditorController | null>,
  showInputPanel: () => void,
): UseFocusModeResult {
  const isFocusMode = ref<boolean>(false)
  const isFocusModeHelpOpen = ref<boolean>(false)

  async function switchMode(enabled: boolean): Promise<void> {
    const viewState = markdownEditor.value?.captureViewState() ?? null
    showInputPanel()
    isFocusModeHelpOpen.value = false
    isFocusMode.value = enabled
    await nextTick()

    if (viewState) {
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
    if (event.key !== 'Escape' || !markdownEditor.value?.isConnected()) {
      return
    }

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
    isFocusModeHelpOpen,
    enterFocusMode,
    exitFocusMode,
    toggleFocusModeHelp,
  }
}
