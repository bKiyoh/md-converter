import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { OUTPUT_FORMATS } from '../types/conversion'
import {
  DEFAULT_OUTPUT_FORMAT,
  OUTPUT_FORMAT_STORAGE_KEY,
  useOutputFormatPreference,
  type OutputFormatStorage,
} from './useOutputFormatPreference'

function mountOutputFormatPreference(storage: OutputFormatStorage): VueWrapper {
  return mount(
    defineComponent({
      setup() {
        return {
          ...useOutputFormatPreference(storage),
          outputFormats: OUTPUT_FORMATS,
        }
      },
      template: `
        <select v-model="selectedFormat">
          <option
            v-for="format in outputFormats"
            :key="format"
            :value="format"
          >
            {{ format }}
          </option>
        </select>
      `,
    }),
  )
}

describe('useOutputFormatPreference', () => {
  it('保存値がない場合はSlackを使用する', () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    }

    const wrapper = mountOutputFormatPreference(storage)

    expect(wrapper.get<HTMLSelectElement>('select').element.value).toBe(DEFAULT_OUTPUT_FORMAT)
    expect(storage.getItem).toHaveBeenCalledWith(OUTPUT_FORMAT_STORAGE_KEY)
  })

  it.each(OUTPUT_FORMATS)(
    '保存済みの変換形式%sを復元する',
    (storedFormat) => {
      const storage = {
        getItem: vi.fn(() => storedFormat),
        setItem: vi.fn(),
      }

      const wrapper = mountOutputFormatPreference(storage)

      expect(wrapper.get<HTMLSelectElement>('select').element.value).toBe(storedFormat)
    },
  )

  it('変換形式の変更を即時保存する', async () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    }
    const wrapper = mountOutputFormatPreference(storage)

    await wrapper.get<HTMLSelectElement>('select').setValue('plain-text')

    expect(storage.setItem).toHaveBeenCalledTimes(1)
    expect(storage.setItem).toHaveBeenCalledWith(OUTPUT_FORMAT_STORAGE_KEY, 'plain-text')
  })

  it('保存値が不正な場合はSlackへフォールバックする', () => {
    const storage = {
      getItem: vi.fn(() => 'unknown-format'),
      setItem: vi.fn(),
    }

    const wrapper = mountOutputFormatPreference(storage)

    expect(wrapper.get<HTMLSelectElement>('select').element.value).toBe(DEFAULT_OUTPUT_FORMAT)
  })

  it('Storageの読み書きが失敗しても画面上の形式を変更できる', async () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new DOMException('denied')
      }),
      setItem: vi.fn(() => {
        throw new DOMException('quota exceeded')
      }),
    }
    const wrapper = mountOutputFormatPreference(storage)
    const select = wrapper.get<HTMLSelectElement>('select')

    expect(select.element.value).toBe(DEFAULT_OUTPUT_FORMAT)

    await select.setValue('backlog-notation')

    expect(select.element.value).toBe('backlog-notation')
    expect(storage.setItem).toHaveBeenCalledWith(
      OUTPUT_FORMAT_STORAGE_KEY,
      'backlog-notation',
    )
  })
})
