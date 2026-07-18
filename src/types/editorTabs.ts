export type EditorTab = {
  id: string
  name: string
  content: string
  createdAt: number
  updatedAt: number
}

export type DeletedTab = EditorTab & {
  deletedAt: number
  previousIndex: number
}

export type EditorState = {
  version: 1
  tabs: EditorTab[]
  activeTabId: string
  deletedTabs: DeletedTab[]
}
