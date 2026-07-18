import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  type ComputedRef,
  type Ref,
} from 'vue'
import {
  DEFAULT_WORKSPACE_SPLIT_RATIO,
  MAX_WORKSPACE_SPLIT_RATIO,
  MIN_WORKSPACE_SPLIT_RATIO,
} from './useAppSettings'

const MIN_PANE_WIDTH_PX = 280
const SPLITTER_WIDTH_PX = 20
const KEYBOARD_STEP = 0.05

export type UseWorkspaceSplitterResult = {
  setWorkspaceElement: (element: unknown) => void
  isResizing: Ref<boolean>
  splitRatioPercent: ComputedRef<number>
  minimumSplitRatioPercent: ComputedRef<number>
  maximumSplitRatioPercent: ComputedRef<number>
  workspaceGridTemplateColumns: ComputedRef<string>
  handlePointerDown: (event: PointerEvent) => void
  handlePointerMove: (event: PointerEvent) => void
  handlePointerEnd: (event: PointerEvent) => void
  handleKeydown: (event: KeyboardEvent) => void
  resetSplitRatio: () => void
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}

export function useWorkspaceSplitter(splitRatio: Ref<number>): UseWorkspaceSplitterResult {
  const workspace = ref<HTMLElement | null>(null)
  const workspaceWidth = ref<number>(0)
  const isResizing = ref<boolean>(false)
  let activePointerId: number | null = null
  let resizeObserver: ResizeObserver | null = null

  const minimumSplitRatio = computed<number>(() => {
    const availableWidth = workspaceWidth.value - SPLITTER_WIDTH_PX

    if (availableWidth <= 0) {
      return MIN_WORKSPACE_SPLIT_RATIO
    }

    return clamp(
      MIN_PANE_WIDTH_PX / availableWidth,
      MIN_WORKSPACE_SPLIT_RATIO,
      DEFAULT_WORKSPACE_SPLIT_RATIO,
    )
  })
  const maximumSplitRatio = computed<number>(() =>
    Math.min(MAX_WORKSPACE_SPLIT_RATIO, 1 - minimumSplitRatio.value),
  )
  const effectiveSplitRatio = computed<number>(() =>
    clamp(splitRatio.value, minimumSplitRatio.value, maximumSplitRatio.value),
  )
  const splitRatioPercent = computed<number>(() => Math.round(effectiveSplitRatio.value * 100))
  const minimumSplitRatioPercent = computed<number>(() =>
    Math.ceil(minimumSplitRatio.value * 100),
  )
  const maximumSplitRatioPercent = computed<number>(() =>
    Math.floor(maximumSplitRatio.value * 100),
  )
  const workspaceGridTemplateColumns = computed<string>(
    () =>
      `minmax(${MIN_PANE_WIDTH_PX}px, ${effectiveSplitRatio.value}fr) ${SPLITTER_WIDTH_PX}px minmax(${MIN_PANE_WIDTH_PX}px, ${1 - effectiveSplitRatio.value}fr)`,
  )

  function measureWorkspace(): void {
    workspaceWidth.value = workspace.value?.getBoundingClientRect().width ?? 0
  }

  function setWorkspaceElement(element: unknown): void {
    workspace.value = element instanceof HTMLElement ? element : null
    measureWorkspace()
  }

  function setSplitRatio(value: number): void {
    const nextRatio = clamp(value, minimumSplitRatio.value, maximumSplitRatio.value)
    splitRatio.value = Math.round(nextRatio * 10_000) / 10_000
  }

  function handlePointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()
    measureWorkspace()
    activePointerId = event.pointerId
    isResizing.value = true
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.setPointerCapture?.(event.pointerId)
    }
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!isResizing.value || event.pointerId !== activePointerId || !workspace.value) {
      return
    }

    const bounds = workspace.value.getBoundingClientRect()
    const availableWidth = bounds.width - SPLITTER_WIDTH_PX

    if (availableWidth <= 0) {
      return
    }

    const nextRatio = (event.clientX - bounds.left - SPLITTER_WIDTH_PX / 2) / availableWidth
    setSplitRatio(nextRatio)
  }

  function handlePointerEnd(event: PointerEvent): void {
    if (event.pointerId !== activePointerId) {
      return
    }

    if (
      event.currentTarget instanceof HTMLElement &&
      event.currentTarget.hasPointerCapture?.(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    activePointerId = null
    isResizing.value = false
  }

  function handleKeydown(event: KeyboardEvent): void {
    let nextRatio: number | null = null

    if (event.key === 'ArrowLeft') {
      nextRatio = effectiveSplitRatio.value - KEYBOARD_STEP
    } else if (event.key === 'ArrowRight') {
      nextRatio = effectiveSplitRatio.value + KEYBOARD_STEP
    } else if (event.key === 'Home') {
      nextRatio = minimumSplitRatio.value
    } else if (event.key === 'End') {
      nextRatio = maximumSplitRatio.value
    }

    if (nextRatio === null) {
      return
    }

    event.preventDefault()
    setSplitRatio(nextRatio)
  }

  function resetSplitRatio(): void {
    setSplitRatio(DEFAULT_WORKSPACE_SPLIT_RATIO)
  }

  onMounted(() => {
    measureWorkspace()
    window.addEventListener('resize', measureWorkspace)

    if (typeof ResizeObserver !== 'undefined' && workspace.value) {
      resizeObserver = new ResizeObserver(measureWorkspace)
      resizeObserver.observe(workspace.value)
    }
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', measureWorkspace)
    resizeObserver?.disconnect()
  })

  return {
    setWorkspaceElement,
    isResizing,
    splitRatioPercent,
    minimumSplitRatioPercent,
    maximumSplitRatioPercent,
    workspaceGridTemplateColumns,
    handlePointerDown,
    handlePointerMove,
    handlePointerEnd,
    handleKeydown,
    resetSplitRatio,
  }
}
