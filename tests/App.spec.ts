import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import App from '../src/App.vue'

describe('App', () => {
  it('Milestone 7のエディタ画面を表示する', () => {
    const wrapper = mount(App)

    expect(wrapper.get('.brand-title-icon').attributes('alt')).toBe('Markdown Converter')
    expect(wrapper.get('.brand-title-icon').attributes('src')).toContain('title-icon-light.png')
    expect(wrapper.get('.brand-title-button').attributes('aria-label')).toBe(
      'このアプリについて',
    )
    expect(wrapper.find('.info-button').exists()).toBe(false)
    expect(wrapper.get('#markdown-input').element.tagName).toBe('TEXTAREA')
    expect(wrapper.get('#conversion-output').attributes('readonly')).toBeDefined()
  })
})
