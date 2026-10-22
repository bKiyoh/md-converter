import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import vueParser from 'vue-eslint-parser'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },
  globalIgnores(['dist/**', 'coverage/**']),
  tseslint.configs.recommended.map((config) => ({
    ...config,
    ...(config.files ? { files: [...config.files, '**/*.vue'] } : {}),
  })),
  pluginVue.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 2024,
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      'vue/block-lang': ['error', { script: { lang: ['ts'], allowNoLang: false } }],
    },
  },
)
