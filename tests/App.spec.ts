import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import App from '../src/App.vue'

describe('App', () => {
  it('Milestone 1の最小画面を表示する', () => {
    const wrapper = mount(App)

    expect(wrapper.get('h1').text()).toBe('開発環境の準備ができました')
  })
})
