<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ConversionWarning } from '../../types/conversion'

const props = defineProps<{
  warnings: ConversionWarning[]
}>()

type GroupedWarning = {
  message: string
  count: number
  locations: string[]
}

const isOpen = ref<boolean>(false)
const warningsRoot = ref<HTMLElement | null>(null)
const warningButton = ref<HTMLButtonElement | null>(null)

const groupedWarnings = computed<GroupedWarning[]>(() => {
  const groups = new Map<string, GroupedWarning>()

  for (const warning of props.warnings) {
    const existingGroup = groups.get(warning.message)
    const location = warning.location
      ? `${warning.location.line}:${warning.location.column}`
      : null

    if (existingGroup) {
      existingGroup.count += 1
      if (location) {
        existingGroup.locations.push(location)
      }
    } else {
      groups.set(warning.message, {
        message: warning.message,
        count: 1,
        locations: location ? [location] : [],
      })
    }
  }

  return [...groups.values()]
})

function togglePopover(): void {
  isOpen.value = !isOpen.value
}

function formatWarningDetail(warning: GroupedWarning): string {
  const count = `${warning.count.toLocaleString('ja-JP')}件`
  return warning.locations.length > 0
    ? `${count}（${warning.locations.join('、')}）`
    : count
}

function closePopover(restoreFocus = false): void {
  if (!isOpen.value) {
    return
  }

  isOpen.value = false

  if (restoreFocus) {
    warningButton.value?.focus()
  }
}

function handleDocumentClick(event: MouseEvent): void {
  if (event.target instanceof Node && !warningsRoot.value?.contains(event.target)) {
    closePopover()
  }
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && isOpen.value) {
    event.preventDefault()
    closePopover(true)
  }
}

watch(
  () => props.warnings.length,
  (warningCount) => {
    if (warningCount === 0) {
      closePopover()
    }
  },
)

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('keydown', handleDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('keydown', handleDocumentKeydown)
})
</script>

<template>
  <div v-if="warnings.length > 0" ref="warningsRoot" class="warnings-root">
    <button
      ref="warningButton"
      class="warning-summary-button"
      type="button"
      :aria-expanded="isOpen"
      aria-controls="conversion-warnings-popover"
      @click="togglePopover"
    >
      <span class="warning-symbol" aria-hidden="true">⚠</span>
      警告 {{ warnings.length.toLocaleString('ja-JP') }}件
    </button>

    <section
      v-if="isOpen"
      id="conversion-warnings-popover"
      class="warnings warning-popover"
      aria-labelledby="warnings-heading"
    >
      <div class="warnings-header">
        <h3 id="warnings-heading">変換時の警告</h3>
        <button
          class="warnings-close-button"
          type="button"
          aria-label="警告一覧を閉じる"
          @click="closePopover(true)"
        >
          閉じる
        </button>
      </div>

      <ul>
        <li v-for="warning in groupedWarnings" :key="warning.message">
          <p>{{ warning.message }}</p>
          <p class="warning-detail">{{ formatWarningDetail(warning) }}</p>
        </li>
      </ul>
    </section>
  </div>
</template>
