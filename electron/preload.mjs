import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('videoApp', {
  bootstrap: () => ipcRenderer.invoke('app:bootstrap'),
  createProject: (input) => ipcRenderer.invoke('projects:create', input),
  getProject: (projectId) => ipcRenderer.invoke('projects:get', projectId),
  updateProject: (projectId, patch) =>
    ipcRenderer.invoke('projects:update', { projectId, patch }),
  pickDirectory: () => ipcRenderer.invoke('dialog:pick-directory'),
  exportProjectToRepo: (projectId) =>
    ipcRenderer.invoke('projects:export-to-repo', projectId),
  getGitStatus: (repoPath) => ipcRenderer.invoke('git:status', repoPath),
  publishRepository: (payload) => ipcRenderer.invoke('git:publish', payload),
})
