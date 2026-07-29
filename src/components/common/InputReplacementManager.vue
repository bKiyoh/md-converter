<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import type {
  InputReplacementRule,
  InputReplacementValidationErrors,
} from '../../types/inputReplacement'
import {
  INPUT_REPLACEMENT_LIMIT_MESSAGE,
  MAX_INPUT_REPLACEMENT_RULES,
  validateInputReplacementDraft,
} from '../../utils/inputReplacement'
import AppIcon from './AppIcon.vue'
import IconButton from './IconButton.vue'

const props = defineProps<{
  rules: readonly InputReplacementRule[]
}>()

const emit = defineEmits<{
  add: [source: string, replacement: string]
  update: [id: string, source: string, replacement: string]
  'update-enabled': [id: string, enabled: boolean]
  delete: [id: string]
  close: []
}>()

type EditableRule = {
  source: string
  replacement: string
  errors: InputReplacementValidationErrors
}

const title = ref<HTMLHeadingElement | null>(null)
const modal = ref<HTMLElement | null>(null)
const newSource = ref<string>('')
const newReplacement = ref<string>('')
const addErrors = ref<InputReplacementValidationErrors>({})
const editableRules = ref<Record<string, EditableRule>>({})

watch(
  () => props.rules,
  (rules) => {
    const nextRules: Record<string, EditableRule> = {}
    for (const rule of rules) {
      nextRules[rule.id] = editableRules.value[rule.id] ?? {
        source: rule.source,
        replacement: rule.replacement,
        errors: {},
      }
    }
    editableRules.value = nextRules
  },
  { immediate: true, deep: true },
)

function readChecked(event: Event): boolean {
  return (event.target as HTMLInputElement).checked
}

function addRule(): void {
  if (props.rules.length >= MAX_INPUT_REPLACEMENT_RULES) {
    addErrors.value = { general: INPUT_REPLACEMENT_LIMIT_MESSAGE }
    return
  }

  const validation = validateInputReplacementDraft(
    { source: newSource.value, replacement: newReplacement.value },
    props.rules,
  )
  addErrors.value = validation.errors

  if (Object.keys(validation.errors).length > 0) {
    return
  }

  emit('add', validation.source, validation.replacement)
  newSource.value = ''
  newReplacement.value = ''
}

function saveRule(rule: InputReplacementRule): void {
  const editable = editableRules.value[rule.id]
  if (!editable) {
    return
  }

  const validation = validateInputReplacementDraft(
    { source: editable.source, replacement: editable.replacement },
    props.rules,
    rule.id,
  )
  editable.errors = validation.errors

  if (Object.keys(validation.errors).length === 0) {
    editable.source = validation.source
    emit('update', rule.id, validation.source, validation.replacement)
  }
}

function handleModalKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    emit('close')
    return
  }

  if (event.key !== 'Tab') {
    return
  }

  const focusable = Array.from(
    modal.value?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ) ?? [],
  )
  const first = focusable[0]
  const last = focusable.at(-1)

  if (!first || !last) {
    return
  }

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

onMounted(() => {
  void nextTick(() => title.value?.focus())
})
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <section
      ref="modal"
      class="input-replacement-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="input-replacement-title"
      @keydown="handleModalKeydown"
    >
      <div class="input-replacement-modal-header">
        <div>
          <h2
            id="input-replacement-title"
            ref="title"
            tabindex="-1"
          >
            入力置換
          </h2>
          <p>登録した文字を、入力時に別の文字へ置き換えます。</p>
        </div>
        <IconButton
          accessible-label="入力置換ルール管理を閉じる"
          tooltip="閉じる"
          @click="emit('close')"
        >
          <AppIcon name="close" />
        </IconButton>
      </div>

      <form class="input-replacement-add-form" @submit.prevent="addRule">
        <h3>ルールを追加</h3>
        <div class="input-replacement-fields">
          <div class="input-replacement-field">
            <label for="new-replacement-source">入力文字</label>
            <input
              id="new-replacement-source"
              v-model="newSource"
              type="text"
              autocomplete="off"
              :aria-invalid="Boolean(addErrors.source)"
            />
            <p v-if="addErrors.source" class="form-error" role="alert">
              {{ addErrors.source }}
            </p>
          </div>
          <span class="input-replacement-arrow" aria-hidden="true">→</span>
          <div class="input-replacement-field">
            <label for="new-replacement-value">置換後の文字</label>
            <input
              id="new-replacement-value"
              v-model="newReplacement"
              type="text"
              autocomplete="off"
              :aria-invalid="Boolean(addErrors.replacement)"
            />
            <p v-if="addErrors.replacement" class="form-error" role="alert">
              {{ addErrors.replacement }}
            </p>
          </div>
          <button
            class="input-replacement-primary-button"
            type="submit"
            :disabled="rules.length >= MAX_INPUT_REPLACEMENT_RULES"
          >
            追加
          </button>
        </div>
        <p v-if="addErrors.general" class="form-error" role="alert">
          {{ addErrors.general }}
        </p>
      </form>

      <div class="input-replacement-list-header">
        <h3>登録済みルール</h3>
        <span>{{ rules.length }} / {{ MAX_INPUT_REPLACEMENT_RULES }}件</span>
      </div>

      <p v-if="rules.length === 0" class="input-replacement-empty">
        登録済みのルールはありません。
      </p>

      <ul v-else class="input-replacement-list">
        <li
          v-for="rule in rules"
          :key="rule.id"
          class="input-replacement-rule"
        >
          <label class="input-replacement-enabled">
            <input
              type="checkbox"
              :checked="rule.enabled"
              @change="emit('update-enabled', rule.id, readChecked($event))"
            />
            <span>{{ rule.enabled ? '有効' : '無効' }}</span>
          </label>
          <div class="input-replacement-field">
            <label :for="`replacement-source-${rule.id}`">入力文字</label>
            <input
              :id="`replacement-source-${rule.id}`"
              v-model="editableRules[rule.id]!.source"
              type="text"
              autocomplete="off"
              :aria-invalid="Boolean(editableRules[rule.id]?.errors.source)"
            />
            <p
              v-if="editableRules[rule.id]?.errors.source"
              class="form-error"
              role="alert"
            >
              {{ editableRules[rule.id]?.errors.source }}
            </p>
          </div>
          <span class="input-replacement-arrow" aria-hidden="true">→</span>
          <div class="input-replacement-field">
            <label :for="`replacement-value-${rule.id}`">置換後の文字</label>
            <input
              :id="`replacement-value-${rule.id}`"
              v-model="editableRules[rule.id]!.replacement"
              type="text"
              autocomplete="off"
              :aria-invalid="Boolean(editableRules[rule.id]?.errors.replacement)"
            />
            <p
              v-if="editableRules[rule.id]?.errors.replacement"
              class="form-error"
              role="alert"
            >
              {{ editableRules[rule.id]?.errors.replacement }}
            </p>
          </div>
          <button
            class="input-replacement-save-button"
            type="button"
            @click="saveRule(rule)"
          >
            保存
          </button>
          <IconButton
            class="input-replacement-delete-button"
            :accessible-label="`${rule.source}の置換ルールを削除`"
            tooltip="削除"
            @click="emit('delete', rule.id)"
          >
            <AppIcon name="trash" />
          </IconButton>
        </li>
      </ul>
    </section>
  </div>
</template>
