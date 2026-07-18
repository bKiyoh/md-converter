<script setup lang="ts">
import { ref } from 'vue'
import AppIcon from '../common/AppIcon.vue'
import IconButton from '../common/IconButton.vue'
import { outputFormatOptions } from '../../converters/converterRegistry'
import type { OutputFormat } from '../../types/conversion'

defineProps<{
  modelValue: OutputFormat
}>()

const emit = defineEmits<{
  'update:modelValue': [value: OutputFormat]
}>()
const formatSelect = ref<HTMLSelectElement | null>(null)

function updateFormat(event: Event): void {
  emit(
    'update:modelValue',
    (event.target as HTMLSelectElement).value as OutputFormat,
  )
}

function openFormatSelect(event: MouseEvent): void {
  event.preventDefault()
  const element = formatSelect.value

  if (!element) {
    return
  }

  element.focus()

  if (typeof element.showPicker !== 'function') {
    element.click()
    return
  }

  try {
    element.showPicker()
  } catch {
    element.click()
  }
}
</script>

<template>
  <div class="format-field">
    <IconButton
      class="format-field-prefix"
      accessible-label="変換先"
      title="変換先"
      @click="openFormatSelect"
    >
      <AppIcon name="file-output" />
    </IconButton>
    <label class="visually-hidden" for="output-format">変換先</label>
    <select
      id="output-format"
      ref="formatSelect"
      title="変換先"
      :value="modelValue"
      @change="updateFormat"
    >
      <option
        v-for="option in outputFormatOptions"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
  </div>
</template>
