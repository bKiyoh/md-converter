import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import App from './App.vue'

describe('App', () => {
  it('入力を選択中の形式へリアルタイム変換し、文字数を表示する', async () => {
    const wrapper = mount(App)
    const input = wrapper.get<HTMLTextAreaElement>('#markdown-input')
    const output = wrapper.get<HTMLTextAreaElement>('#conversion-output')

    await input.setValue('# 見出し😀')

    expect(output.element.value).toBe('*見出し😀*')
    expect(wrapper.get('#markdown-input-count').text()).toBe('6文字')
    expect(wrapper.get('#conversion-output-count').text()).toBe('6文字')
    expect(wrapper.get('.warnings').text()).toContain('見出しレベルを表現できない')
  })

  it('4つの出力形式を切り替えられる', async () => {
    const wrapper = mount(App)
    const input = wrapper.get<HTMLInputElement>('#markdown-input')
    const format = wrapper.get<HTMLSelectElement>('#output-format')

    expect(format.findAll('option')).toHaveLength(4)

    await input.setValue('**重要**')
    await format.setValue('backlog-notation')

    expect(wrapper.get<HTMLTextAreaElement>('#conversion-output').element.value).toBe("''重要''")
  })

  it('入力を全削除できる', async () => {
    const wrapper = mount(App)
    const input = wrapper.get<HTMLTextAreaElement>('#markdown-input')

    await input.setValue('削除する内容')
    await wrapper.get('.secondary-button').trigger('click')

    expect(input.element.value).toBe('')
    expect(wrapper.get<HTMLTextAreaElement>('#conversion-output').element.value).toBe('')
  })

  it('テーマを手動で切り替えられる', async () => {
    const wrapper = mount(App)
    const themeButton = wrapper.get<HTMLButtonElement>('.theme-button')

    expect(wrapper.get('.app').attributes('data-theme')).toBe('light')
    expect(themeButton.attributes('aria-pressed')).toBe('false')

    await themeButton.trigger('click')

    expect(wrapper.get('.app').attributes('data-theme')).toBe('dark')
    expect(themeButton.attributes('aria-pressed')).toBe('true')
  })
})
