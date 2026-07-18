import type { Directive } from 'vue'

const TOOLTIP_GAP_PX = 8
const VIEWPORT_MARGIN_PX = 8

type TooltipState = {
  text: string
  tooltip: HTMLDivElement | null
  hovered: boolean
  focused: boolean
  show: () => void
  hide: () => void
  position: () => void
  handleMouseEnter: () => void
  handleMouseLeave: () => void
  handleFocusIn: () => void
  handleFocusOut: (event: FocusEvent) => void
  handleKeydown: (event: KeyboardEvent) => void
}

const tooltipStates = new WeakMap<HTMLElement, TooltipState>()
let activeTooltipState: TooltipState | null = null
let tooltipId = 0

function normalizeTooltipText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function removeTooltip(state: TooltipState): void {
  state.tooltip?.remove()
  state.tooltip = null

  if (activeTooltipState === state) {
    activeTooltipState = null
  }

  window.removeEventListener('resize', state.position)
  document.removeEventListener('scroll', state.position, true)
}

function createTooltipState(element: HTMLElement, text: string): TooltipState {
  const state = {} as TooltipState

  state.text = text
  state.tooltip = null
  state.hovered = false
  state.focused = false
  state.position = (): void => {
    const tooltip = state.tooltip

    if (!tooltip) {
      return
    }

    const targetRect = element.getBoundingClientRect()
    const tooltipRect = tooltip.getBoundingClientRect()
    const maximumLeft = Math.max(
      VIEWPORT_MARGIN_PX,
      window.innerWidth - tooltipRect.width - VIEWPORT_MARGIN_PX,
    )
    const centeredLeft = targetRect.left + (targetRect.width - tooltipRect.width) / 2
    const left = Math.min(Math.max(centeredLeft, VIEWPORT_MARGIN_PX), maximumLeft)
    const belowTop = targetRect.bottom + TOOLTIP_GAP_PX
    const aboveTop = targetRect.top - tooltipRect.height - TOOLTIP_GAP_PX
    const fitsBelow = belowTop + tooltipRect.height <= window.innerHeight - VIEWPORT_MARGIN_PX
    const top = fitsBelow ? belowTop : Math.max(VIEWPORT_MARGIN_PX, aboveTop)

    tooltip.style.left = `${Math.round(left)}px`
    tooltip.style.top = `${Math.round(top)}px`
  }
  state.show = (): void => {
    if (!state.text || state.tooltip || !element.isConnected) {
      return
    }

    if (activeTooltipState && activeTooltipState !== state) {
      removeTooltip(activeTooltipState)
    }

    const tooltip = document.createElement('div')
    tooltip.id = `app-tooltip-${tooltipId += 1}`
    tooltip.className = 'app-tooltip'
    tooltip.setAttribute('role', 'tooltip')
    tooltip.textContent = state.text
    document.body.append(tooltip)
    state.tooltip = tooltip
    activeTooltipState = state
    state.position()
    window.addEventListener('resize', state.position)
    document.addEventListener('scroll', state.position, true)
  }
  state.hide = (): void => {
    removeTooltip(state)
  }
  state.handleMouseEnter = (): void => {
    state.hovered = true
    state.show()
  }
  state.handleMouseLeave = (): void => {
    state.hovered = false

    if (!state.focused) {
      state.hide()
    }
  }
  state.handleFocusIn = (): void => {
    state.focused = true
    state.show()
  }
  state.handleFocusOut = (event: FocusEvent): void => {
    if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget)) {
      return
    }

    state.focused = false

    if (!state.hovered) {
      state.hide()
    }
  }
  state.handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      state.hide()
    }
  }

  return state
}

export const tooltipDirective: Directive<HTMLElement, string | undefined> = {
  mounted(element, binding) {
    const text = normalizeTooltipText(binding.value)
    const state = createTooltipState(element, text)
    tooltipStates.set(element, state)
    element.dataset.tooltip = text
    element.addEventListener('mouseenter', state.handleMouseEnter)
    element.addEventListener('mouseleave', state.handleMouseLeave)
    element.addEventListener('focusin', state.handleFocusIn)
    element.addEventListener('focusout', state.handleFocusOut)
    element.addEventListener('keydown', state.handleKeydown)
  },
  updated(element, binding) {
    const state = tooltipStates.get(element)

    if (!state) {
      return
    }

    state.text = normalizeTooltipText(binding.value)
    element.dataset.tooltip = state.text

    if (!state.text) {
      state.hide()
      return
    }

    if (state.tooltip) {
      state.tooltip.textContent = state.text
      state.position()
    }
  },
  unmounted(element) {
    const state = tooltipStates.get(element)

    if (!state) {
      return
    }

    state.hide()
    element.removeEventListener('mouseenter', state.handleMouseEnter)
    element.removeEventListener('mouseleave', state.handleMouseLeave)
    element.removeEventListener('focusin', state.handleFocusIn)
    element.removeEventListener('focusout', state.handleFocusOut)
    element.removeEventListener('keydown', state.handleKeydown)
    tooltipStates.delete(element)
  },
}
