<script setup lang="ts">
import { outputFormatOptions } from "../../converters/converterRegistry";
import type { OutputFormat } from "../../types/conversion";

defineProps<{
  modelValue: OutputFormat;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: OutputFormat];
}>();

function updateFormat(event: Event): void {
  emit(
    "update:modelValue",
    (event.target as HTMLSelectElement).value as OutputFormat,
  );
}
</script>

<template>
  <label for="output-format">変換形式</label>
  <div class="format-field">
    <select id="output-format" :value="modelValue" @change="updateFormat">
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
