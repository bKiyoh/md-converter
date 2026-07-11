import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import App from '../src/App.vue'

describe('App', () => {
  it('Milestone 7のエディタ画面を表示する', () => {
    const wrapper = mount(App)

    expect(wrapper.get('h1').text()).toBe('Markdown変換エディタ')
    expect(wrapper.get('#markdown-input').element.tagName).toBe('TEXTAREA')
    expect(wrapper.get('#conversion-output').attributes('readonly')).toBeDefined()
  })
})
