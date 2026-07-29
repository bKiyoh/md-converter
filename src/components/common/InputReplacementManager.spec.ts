import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { InputReplacementRule } from '../../types/inputReplacement'
import InputReplacementManager from './InputReplacementManager.vue'

const rules: InputReplacementRule[] = [
  { id: 'right', source: '右', replacement: '⇨', enabled: true },
]

describe('InputReplacementManager', () => {
  it('ルールを追加する', async () => {
    const wrapper = mount(InputReplacementManager, {
      props: { rules: [] },
      attachTo: document.body,
    })

    await wrapper.get('#new-replacement-source').setValue(' あい ')
    await wrapper.get('#new-replacement-value').setValue('AI')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('add')).toEqual([['あい', 'AI']])
    wrapper.unmount()
  })

  it('Markdown記法と重複をエラー表示する', async () => {
    const wrapper = mount(InputReplacementManager, {
      props: { rules },
    })

    await wrapper.get('#new-replacement-source').setValue('右')
    await wrapper.get('#new-replacement-value').setValue('**太字**')
    await wrapper.get('form').trigger('submit')

    const errors = wrapper.findAll('.form-error').map((error) => error.text())
    expect(errors).toContain('同じ入力文字がすでに登録されています。')
    expect(errors).toContain('Markdown記法として使用される内容は登録できません。')
    expect(wrapper.emitted('add')).toBeUndefined()
  })

  it('有効切り替え、編集、削除を通知する', async () => {
    const wrapper = mount(InputReplacementManager, {
      props: { rules },
    })

    await wrapper.get<HTMLInputElement>('.input-replacement-enabled input').setValue(false)
    await wrapper.get(`#replacement-source-right`).setValue('みぎ')
    await wrapper.get('.input-replacement-save-button').trigger('click')
    await wrapper.get('.input-replacement-delete-button').trigger('click')

    expect(wrapper.emitted('update-enabled')).toEqual([['right', false]])
    expect(wrapper.emitted('update')).toEqual([['right', 'みぎ', '⇨']])
    expect(wrapper.emitted('delete')).toEqual([['right']])
  })

  it('Escapeと背景クリックで閉じる', async () => {
    const wrapper = mount(InputReplacementManager, {
      props: { rules: [] },
    })

    await wrapper.get('.input-replacement-modal').trigger('keydown', {
      key: 'Escape',
    })
    await wrapper.get('.modal-backdrop').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(2)
  })
})
