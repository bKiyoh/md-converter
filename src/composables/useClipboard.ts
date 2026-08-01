import { onBeforeUnmount, ref, type Ref } from 'vue'

export const COPY_FAILURE_MESSAGE =
  'コピーに失敗しました。変換結果を選択して手動でコピーしてください。'
export const COPY_NOTICE_DURATION_MS = 4_000

export type ClipboardWriter = Pick<Clipboard, 'writeText'>

export type ClipboardNotice = {
  kind: 'success' | 'error'
  message: string
}

export type UseClipboardResult = {
  copy: (
    text: string,
    successMessage: string,
    failureMessage?: string,
  ) => Promise<boolean>
  notice: Ref<ClipboardNotice | null>
}

function getBrowserClipboard(): ClipboardWriter | null {
  try {
    return typeof navigator === 'undefined' ? null : (navigator.clipboard ?? null)
  } catch {
    return null
  }
}

export function useClipboard(
  clipboard: ClipboardWriter | null = getBrowserClipboard(),
): UseClipboardResult {
  const notice = ref<ClipboardNotice | null>(null)
  let noticeTimer: ReturnType<typeof setTimeout> | undefined

  function showNotice(nextNotice: ClipboardNotice): void {
    notice.value = nextNotice

    if (noticeTimer !== undefined) {
      clearTimeout(noticeTimer)
    }

    noticeTimer = setTimeout(() => {
      notice.value = null
      noticeTimer = undefined
    }, COPY_NOTICE_DURATION_MS)
  }

  async function copy(
    text: string,
    successMessage: string,
    failureMessage = COPY_FAILURE_MESSAGE,
  ): Promise<boolean> {
    try {
      if (!clipboard) {
        throw new Error('Clipboard API is unavailable')
      }

      await clipboard.writeText(text)
      showNotice({ kind: 'success', message: successMessage })
      return true
    } catch {
      showNotice({ kind: 'error', message: failureMessage })
      return false
    }
  }

  onBeforeUnmount(() => {
    if (noticeTimer !== undefined) {
      clearTimeout(noticeTimer)
    }
  })

  return { copy, notice }
}
