// @vitest-environment node
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const eslint = new ESLint()

describe('ESLint configuration', () => {
  it('VueのTypeScriptスクリプトとテンプレートの型構文を解析できる', async () => {
    const [result] = await eslint.lintText(
      '<script setup lang="ts">\nconst value: unknown = "text"\n</script>\n'
        + '<template>{{ (value as string).toUpperCase() }}</template>',
      { filePath: 'src/LintExample.vue' },
    )

    expect(result.messages).toEqual([])
  })

  it.each([
    ['src/lintExample.ts', 'export const value: any = "text"'],
    [
      'src/LintExample.vue',
      '<script setup lang="ts">\nconst value: any = "text"\n</script>\n'
        + '<template>{{ value }}</template>',
    ],
  ])('%sでTypeScriptの推奨ルールを維持する', async (filePath, source) => {
    const [result] = await eslint.lintText(source, { filePath })

    expect(result.fatalErrorCount).toBe(0)
    expect(result.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: '@typescript-eslint/no-explicit-any', severity: 2 }),
    ]))
  })

  it('Vueのscript言語制限とessentialルールを維持する', async () => {
    const [result] = await eslint.lintText(
      '<script setup>\nconst value = "text"\n</script>\n'
        + '<template><div v-if="value" v-else>{{ value }}</div></template>',
      { filePath: 'src/LintExample.vue' },
    )

    expect(result.fatalErrorCount).toBe(0)
    expect(result.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'vue/block-lang', severity: 2 }),
      expect.objectContaining({ ruleId: 'vue/valid-v-else', severity: 2 }),
    ]))
  })
})
