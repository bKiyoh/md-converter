<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import AppIcon from './AppIcon.vue'
import IconButton from './IconButton.vue'

defineProps<{
  darkMode: boolean
  editorInternalScroll: boolean
  inputReplacementEnabled: boolean
}>()

const emit = defineEmits<{
  'update:darkMode': [value: boolean]
  'update:editorInternalScroll': [value: boolean]
  'update:inputReplacementEnabled': [value: boolean]
  'manage-input-replacements': []
}>()

const isOpen = ref<boolean>(false)
const settingsRoot = ref<HTMLElement | null>(null)

function togglePopover(): void {
  isOpen.value = !isOpen.value
}

function closePopover(restoreFocus = false): void {
  if (!isOpen.value) {
    return
  }

  isOpen.value = false

  if (restoreFocus) {
    settingsRoot.value?.querySelector<HTMLButtonElement>('.settings-button')?.focus()
  }
}

function handleDocumentClick(event: MouseEvent): void {
  if (event.target instanceof Node && !settingsRoot.value?.contains(event.target)) {
    closePopover()
  }
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && isOpen.value) {
    event.preventDefault()
    closePopover(true)
  }
}

function readChecked(event: Event): boolean {
  return (event.target as HTMLInputElement).checked
}

function openInputReplacementManager(): void {
  closePopover()
  emit('manage-input-replacements')
}

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
  <div ref="settingsRoot" class="settings-root">
    <IconButton
      class="settings-button"
      accessible-label="設定"
      tooltip="設定"
      aria-haspopup="true"
      :aria-expanded="isOpen"
      aria-controls="settings-popover"
      @click="togglePopover"
    >
      <AppIcon name="settings" />
    </IconButton>

    <section
      v-if="isOpen"
      id="settings-popover"
      class="settings-popover"
      aria-labelledby="settings-popover-title"
    >
      <h2 id="settings-popover-title">設定</h2>

      <div class="setting-item">
        <div class="setting-row setting-row--static">
          <span class="setting-name">テーマ</span>
          <IconButton
            id="dark-mode-setting"
            class="setting-theme-button"
            :accessible-label="
              darkMode ? 'ライトモードに切り替える' : 'ダークモードに切り替える'
            "
            :tooltip="darkMode ? 'ライトモードに切り替える' : 'ダークモードに切り替える'"
            :aria-pressed="darkMode"
            @click="emit('update:darkMode', !darkMode)"
          >
            <AppIcon :name="darkMode ? 'sun' : 'moon'" />
          </IconButton>
        </div>
      </div>

      <div class="setting-item">
        <label class="setting-row" for="editor-scroll-setting">
          <span class="setting-name">エディター内部をスクロール</span>
          <span class="switch-group">
            <input
              id="editor-scroll-setting"
              class="switch-input"
              type="checkbox"
              role="switch"
              :checked="editorInternalScroll"
              aria-describedby="editor-scroll-description"
              @change="emit('update:editorInternalScroll', readChecked($event))"
            />
            <span class="switch-track" aria-hidden="true">
              <span class="switch-thumb" />
            </span>
            <span class="switch-state">{{ editorInternalScroll ? 'ON' : 'OFF' }}</span>
          </span>
        </label>
        <p id="editor-scroll-description" class="setting-description">
          OFFにすると、入力内容に合わせてエディターとプレビューが縦に広がります。
        </p>
      </div>

      <div class="setting-item">
        <label class="setting-row" for="input-replacement-setting">
          <span class="setting-name">入力置換を有効にする</span>
          <span class="switch-group">
            <input
              id="input-replacement-setting"
              class="switch-input"
              type="checkbox"
              role="switch"
              :checked="inputReplacementEnabled"
              aria-describedby="input-replacement-description"
              @change="
                emit('update:inputReplacementEnabled', readChecked($event))
              "
            />
            <span class="switch-track" aria-hidden="true">
              <span class="switch-thumb" />
            </span>
            <span class="switch-state">
              {{ inputReplacementEnabled ? 'ON' : 'OFF' }}
            </span>
          </span>
        </label>
        <p id="input-replacement-description" class="setting-description">
          登録した文字を、入力時に別の文字へ置き換えます。
        </p>
        <button
          class="setting-manage-button"
          type="button"
          @click="openInputReplacementManager"
        >
          置換ルールを管理
        </button>
      </div>
    </section>
  </div>
</template>
