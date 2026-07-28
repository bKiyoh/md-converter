<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { MAX_TAB_NAME_LENGTH } from '../../composables/useEditorStorage'
import type { EditorTab } from '../../types/editorTabs'

const props = withDefaults(
  defineProps<{
    tab: EditorTab
    variant?: 'document-tab' | 'focus'
    active?: boolean
    dragEnabled?: boolean
  }>(),
  {
    variant: 'document-tab',
    active: false,
    dragEnabled: false,
  },
)

const emit = defineEmits<{
  rename: [id: string, name: string]
  select: [id: string]
  keydown: [event: KeyboardEvent]
  dragstart: [event: DragEvent]
  dragend: [event: DragEvent]
}>()

const nameInput = ref<HTMLInputElement | null>(null)
const isEditing = ref<boolean>(false)
const editingName = ref<string>('')

async function startRenaming(): Promise<void> {
  isEditing.value = true
  editingName.value = props.tab.name
  await nextTick()
  nameInput.value?.focus()
  nameInput.value?.select()
}

function confirmRename(): void {
  if (!isEditing.value) {
    return
  }

  const nextName = editingName.value.trim()

  if (nextName.length > 0 && Array.from(nextName).length <= MAX_TAB_NAME_LENGTH) {
    emit('rename', props.tab.id, nextName)
  }

  isEditing.value = false
}

function cancelRename(event: KeyboardEvent): void {
  event.preventDefault()
  event.stopPropagation()
  isEditing.value = false
}

function updateEditingName(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  editingName.value = Array.from(value).slice(0, MAX_TAB_NAME_LENGTH).join('')
}
</script>

<template>
  <input
    v-if="isEditing"
    ref="nameInput"
    :class="
      variant === 'document-tab'
        ? 'editable-tab-name-input document-tab-name-input'
        : 'editable-tab-name-input focus-tab-name-input'
    "
    :value="editingName"
    :aria-label="`${tab.name}の名前を変更`"
    @input="updateEditingName"
    @keydown.enter.prevent="confirmRename"
    @keydown.esc="cancelRename"
    @blur="confirmRename"
  />
  <button
    v-else
    :class="[
      'editable-tab-name-button',
      variant === 'document-tab' ? 'document-tab-button' : 'focus-tab-name-button',
      { 'document-tab-button--active': variant === 'document-tab' && active },
    ]"
    type="button"
    :data-document-tab-id="variant === 'document-tab' ? tab.id : undefined"
    :aria-pressed="variant === 'document-tab' ? active : undefined"
    :aria-label="variant === 'focus' ? `${tab.name}の名前を変更` : undefined"
    :draggable="variant === 'document-tab' && dragEnabled"
    @click="emit('select', tab.id)"
    @dblclick="startRenaming"
    @keydown="emit('keydown', $event)"
    @dragstart="emit('dragstart', $event)"
    @dragend="emit('dragend', $event)"
  >
    {{ tab.name }}
  </button>
</template>
