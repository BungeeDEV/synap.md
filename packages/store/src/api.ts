export interface SynapApi {
  fetchTree(): Promise<any[]>
  fetchFile(path: string): Promise<{ content: string, mtime: string }>
  deleteFile(path: string): Promise<void>
  archiveNode(path: string): Promise<void>
  renameNode(oldPath: string, newPath: string): Promise<{ path: string, mtime: string, updatedBacklinks: string[] }>
  createFile(path: string, content: string): Promise<void>
  createFolder(path: string): Promise<void>
  noteFromTemplate(path: string, templateName: string): Promise<void>
  listTemplates(): Promise<any[]>
  dailyNote(): Promise<{ path: string, created: boolean }>
  duplicateNode(path: string): Promise<{ path: string }>
  renderNote(path: string): Promise<{ html: string }>
  updatePreferences(prefs: any): Promise<any>
  fetchPreferences(): Promise<any>
}

let currentApi: SynapApi | null = null

export function setSynapApi(api: SynapApi) {
  currentApi = api
}

export function useSynapApi(): SynapApi {
  if (!currentApi) throw new Error('SynapApi not initialized')
  return currentApi
}
