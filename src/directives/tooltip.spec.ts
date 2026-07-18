import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TooltipTarget from '../components/common/TooltipTarget.vue'
import { tooltipDirective } from './tooltip'

function createRect(
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  }
}

const TooltipFixture = defineComponent({
  directives: { tooltip: tooltipDirective },
  props: {
    message: {
      type: String,
      required: true,
    },
  },
  template: '<button v-tooltip="message" type="button">操作</button>',
})

const DisabledTooltipFixture = defineComponent({
  components: { TooltipTarget },
  template: `
    <TooltipTarget text="現在は操作できません">
      <button type="button" disabled>操作</button>
    </TooltipTarget>
  `,
})

afterEach(() => {
  document.querySelectorAll('.app-tooltip').forEach((tooltip) => tooltip.remove())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('tooltipDirective', () => {
  it('title属性を使わず、ホバー中だけ共通ツールチップを表示する', async () => {
    const wrapper = mount(TooltipFixture, {
      attachTo: document.body,
      props: { message: '操作の説明' },
    })
    const button = wrapper.get('button')

    expect(button.attributes('title')).toBeUndefined()
    expect(button.attributes('data-tooltip')).toBe('操作の説明')
    expect(document.querySelector('.app-tooltip')).toBeNull()

    await button.trigger('mouseenter')

    const tooltip = document.querySelector<HTMLElement>('.app-tooltip')
    expect(tooltip?.textContent).toBe('操作の説明')
    expect(tooltip?.getAttribute('role')).toBe('tooltip')

    await button.trigger('mouseleave')
    expect(document.querySelector('.app-tooltip')).toBeNull()
    wrapper.unmount()
  })

  it('フォーカスで表示し、動的な文言更新とEscapeによる非表示を反映する', async () => {
    const wrapper = mount(TooltipFixture, {
      attachTo: document.body,
      props: { message: '変更前' },
    })
    const button = wrapper.get('button')

    await button.trigger('focusin')
    expect(document.querySelector('.app-tooltip')?.textContent).toBe('変更前')

    await wrapper.setProps({ message: '変更後' })
    expect(button.attributes('data-tooltip')).toBe('変更後')
    expect(document.querySelector('.app-tooltip')?.textContent).toBe('変更後')

    const handledEscapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    button.element.dispatchEvent(handledEscapeEvent)

    expect(handledEscapeEvent.defaultPrevented).toBe(true)
    expect(document.querySelector('.app-tooltip')).toBeNull()

    const unhandledEscapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    button.element.dispatchEvent(unhandledEscapeEvent)

    expect(unhandledEscapeEvent.defaultPrevented).toBe(false)
    wrapper.unmount()
  })

  it('無効なボタンでもホバー時に理由を表示する', async () => {
    const wrapper = mount(DisabledTooltipFixture, {
      attachTo: document.body,
    })

    expect(wrapper.get<HTMLButtonElement>('button').element.disabled).toBe(true)
    await wrapper.get('.tooltip-target').trigger('mouseenter')

    expect(document.querySelector('.app-tooltip')?.textContent).toBe('現在は操作できません')
    wrapper.unmount()
  })

  it('画面右下ではビューポート内の上側へ位置を調整し、破棄時に削除する', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains('app-tooltip')
        ? createRect(0, 0, 100, 30)
        : createRect(280, 180, 20, 10)
    })
    vi.stubGlobal('innerWidth', 300)
    vi.stubGlobal('innerHeight', 200)

    const wrapper = mount(TooltipFixture, {
      attachTo: document.body,
      props: { message: '端の説明' },
    })

    await wrapper.get('button').trigger('mouseenter')

    const tooltip = document.querySelector<HTMLElement>('.app-tooltip')
    expect(tooltip?.style.left).toBe('192px')
    expect(tooltip?.style.top).toBe('142px')

    wrapper.unmount()
    expect(document.querySelector('.app-tooltip')).toBeNull()
  })
})
