<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { DeletedTab, EditorTab } from '../../types/editorTabs'
import { MAX_TAB_NAME_LENGTH } from '../../composables/useEditorStorage'
import AppIcon from '../common/AppIcon.vue'

const props = defineProps<{
  tabs: EditorTab[]
  deletedTabs: DeletedTab[]
  activeTabId: string
  canAddTab: boolean
  canDeleteTab: boolean
}>()

const emit = defineEmits<{
  add: []
  select: [id: string]
  rename: [id: string, name: string]
  delete: [id: string]
  restore: [id: string]
  permanentlyDelete: [id: string]
}>()

const root = ref<HTMLElement | null>(null)
const editingTabId = ref<string | null>(null)
const editingName = ref<string>('')
const deletedTabsOpen = ref<boolean>(false)
const deletedTabsToggle = ref<HTMLButtonElement | null>(null)
const deletedTabsPanel = ref<HTMLElement | null>(null)

function startRenaming(tab: EditorTab): void {
  editingTabId.value = tab.id
  editingName.value = tab.name

  void nextTick(() => {
    const input = root.value?.querySelector<HTMLInputElement>('.document-tab-name-input')
    input?.focus()
    input?.select()
  })
}

function confirmRename(tab: EditorTab): void {
  const nextName = editingName.value.trim()

  if (nextName.length > 0 && Array.from(nextName).length <= MAX_TAB_NAME_LENGTH) {
    emit('rename', tab.id, nextName)
  }

  editingTabId.value = null
}

function cancelRename(): void {
  editingTabId.value = null
}

function updateEditingName(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  editingName.value = Array.from(value).slice(0, MAX_TAB_NAME_LENGTH).join('')
}

async function selectAndFocus(id: string): Promise<void> {
  emit('select', id)
  await nextTick()
  const buttons = root.value?.querySelectorAll<HTMLButtonElement>('[data-document-tab-id]')
  Array.from(buttons ?? []).find((button) => button.dataset.documentTabId === id)?.focus()
}

function scrollActiveTabIntoView(): void {
  const buttons = root.value?.querySelectorAll<HTMLButtonElement>('[data-document-tab-id]')
  const activeButton = Array.from(buttons ?? []).find(
    (button) => button.dataset.documentTabId === props.activeTabId,
  )
  const activeTab = activeButton?.closest('.document-tab-item') as HTMLElement | null

  scrollTabControlIntoView(activeTab)
}

function scrollTabControlIntoView(control: HTMLElement | null): void {
  const tablist = root.value?.querySelector<HTMLElement>('.document-tablist')

  if (!control || !tablist) {
    return
  }

  const tablistRect = tablist.getBoundingClientRect()
  const controlRect = control.getBoundingClientRect()

  if (controlRect.left < tablistRect.left) {
    tablist.scrollLeft += controlRect.left - tablistRect.left
  } else if (controlRect.right > tablistRect.right) {
    tablist.scrollLeft += controlRect.right - tablistRect.right
  }
}

function handleTabKeydown(event: KeyboardEvent, index: number): void {
  let nextIndex: number | null = null

  if (event.key === 'ArrowLeft') {
    nextIndex = index === 0 ? props.tabs.length - 1 : index - 1
  } else if (event.key === 'ArrowRight') {
    nextIndex = index === props.tabs.length - 1 ? 0 : index + 1
  } else if (event.key === 'Home') {
    nextIndex = 0
  } else if (event.key === 'End') {
    nextIndex = props.tabs.length - 1
  }

  if (nextIndex !== null) {
    event.preventDefault()
    void selectAndFocus(props.tabs[nextIndex]!.id)
  }
}

function requestDelete(id: string): void {
  emit('delete', id)
}

async function addTabAndKeepControlsVisible(): Promise<void> {
  emit('add')
  await nextTick()

  const addButton = root.value?.querySelector<HTMLElement>('.document-tab-add-button')
  scrollTabControlIntoView(addButton ?? null)
}

function handleDocumentClick(event: MouseEvent): void {
  if (
    !deletedTabsOpen.value ||
    !(event.target instanceof Node) ||
    deletedTabsToggle.value?.contains(event.target) ||
    deletedTabsPanel.value?.contains(event.target)
  ) {
    return
  }

  deletedTabsOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  scrollActiveTabIntoView()
})

watch(() => props.activeTabId, scrollActiveTabIntoView, { flush: 'post' })

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
})
</script>

<template>
  <section ref="root" class="document-tabs" aria-label="Markdown文書">
    <div class="document-tabs-main">
      <div class="document-tablist" role="group" aria-label="Markdown文書タブ">
        <div
          v-for="(tab, index) in tabs"
          :key="tab.id"
          class="document-tab-item"
          :class="{ 'document-tab-item--active': activeTabId === tab.id }"
        >
          <input
            v-if="editingTabId === tab.id"
            class="document-tab-name-input"
            :value="editingName"
            :aria-label="`${tab.name}の名前を変更`"
            @input="updateEditingName"
            @keydown.enter.prevent="confirmRename(tab)"
            @keydown.esc.prevent="cancelRename"
            @blur="confirmRename(tab)"
          />
          <button
            v-else
            class="document-tab-button"
            :class="{ 'document-tab-button--active': activeTabId === tab.id }"
            type="button"
            :data-document-tab-id="tab.id"
            :aria-pressed="activeTabId === tab.id"
            @click="emit('select', tab.id)"
            @dblclick="startRenaming(tab)"
            @keydown="handleTabKeydown($event, index)"
          >
            {{ tab.name }}
          </button>
          <button
            class="document-tab-delete-button"
            type="button"
            :aria-label="`${tab.name}を削除`"
            title="削除"
            :disabled="!canDeleteTab"
            @click.stop="requestDelete(tab.id)"
          >
            <AppIcon name="close" />
          </button>
        </div>

        <button
          class="document-tab-add-button"
          type="button"
          aria-label="新しいタブを追加"
          :disabled="!canAddTab"
          :title="canAddTab ? '新しいタブを追加' : 'タブは最大7つまで作成できます'"
          @click="addTabAndKeepControlsVisible"
        >
          ＋
        </button>
      </div>

      <button
        ref="deletedTabsToggle"
        class="deleted-tabs-toggle"
        type="button"
        :aria-expanded="deletedTabsOpen"
        aria-controls="deleted-tabs-panel"
        :aria-label="deletedTabsOpen ? '削除済みタブを閉じる' : '削除済みタブを表示'"
        :title="deletedTabsOpen ? '削除済みタブを閉じる' : '削除済みタブ'"
        @click="deletedTabsOpen = !deletedTabsOpen"
      >
        <AppIcon name="trash" />
        <span
          v-if="deletedTabs.length > 0"
          class="deleted-tabs-count"
          aria-hidden="true"
        >
          {{ deletedTabs.length }}
        </span>
      </button>
    </div>

    <section
      v-if="deletedTabsOpen"
      id="deleted-tabs-panel"
      ref="deletedTabsPanel"
      class="deleted-tabs-panel"
      aria-labelledby="deleted-tabs-heading"
    >
      <h2 id="deleted-tabs-heading">削除済みタブ</h2>
      <p v-if="deletedTabs.length === 0" class="deleted-tabs-empty">削除済みタブはありません。</p>
      <ul v-else>
        <li v-for="tab in deletedTabs" :key="tab.id">
          <span>{{ tab.name }}</span>
          <div>
            <button
              class="deleted-tab-action deleted-tab-action--restore"
              type="button"
              :aria-label="`${tab.name}を復元`"
              title="復元"
              @click.stop="emit('restore', tab.id)"
            >
              <AppIcon name="rotate-ccw" />
            </button>
            <button
              class="deleted-tab-action deleted-tab-action--permanent-delete"
              type="button"
              :aria-label="`${tab.name}を完全に削除`"
              title="完全に削除"
              @click.stop="emit('permanentlyDelete', tab.id)"
            >
              <AppIcon name="trash-x" />
            </button>
          </div>
        </li>
      </ul>
    </section>
  </section>
</template>
