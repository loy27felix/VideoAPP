import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ensureDataRoot,
  listProjects,
  getProject,
  createProject,
  updateProject,
} from './storage.mjs'
import { exportProjectToRepository } from './repository.mjs'
import { getGitStatus, publishRepository } from './git.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const workflowSteps = [
  { id: 'script', label: 'Script Core' },
  { id: 'structure', label: 'Story Structure' },
  { id: 'storyboard', label: 'Storyboard' },
  { id: 'prompts', label: 'Prompt Pack' },
  { id: 'canvas', label: 'Canvas Assets' },
  { id: 'export', label: 'Git Export' },
]

const providerCatalog = [
  'OpenAI',
  'Anthropic',
  'Google',
  'DeepSeek',
  'Volcengine',
  'Alibaba Cloud',
]

function getDataRoot() {
  return join(app.getPath('userData'), 'videoapp-data')
}

async function buildBootstrapPayload() {
  const dataRoot = getDataRoot()
  await ensureDataRoot(dataRoot)

  return {
    dataRoot,
    workflowSteps,
    providerCatalog,
    projects: await listProjects(dataRoot),
  }
}

async function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 1280,
    minHeight: 860,
    backgroundColor: '#f2ece2',
    title: 'VideoAPP Studio',
    webPreferences: {
      preload: join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const devServerUrl = process.env.VITE_DEV_SERVER_URL

  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    await mainWindow.loadFile(join(__dirname, '..', 'dist', 'index.html'))
  }
}

ipcMain.handle('app:bootstrap', async () => buildBootstrapPayload())

ipcMain.handle('projects:create', async (_, input) => {
  return createProject(getDataRoot(), input)
})

ipcMain.handle('projects:get', async (_, projectId) => {
  return getProject(getDataRoot(), projectId)
})

ipcMain.handle('projects:update', async (_, { projectId, patch }) => {
  return updateProject(getDataRoot(), projectId, patch)
})

ipcMain.handle('dialog:pick-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
  })

  return result.canceled ? '' : result.filePaths[0]
})

ipcMain.handle('projects:export-to-repo', async (_, projectId) => {
  const project = await getProject(getDataRoot(), projectId)
  return exportProjectToRepository(project)
})

ipcMain.handle('git:status', async (_, repoPath) => {
  return getGitStatus(repoPath)
})

ipcMain.handle('git:publish', async (_, payload) => {
  return publishRepository(payload)
})

app.whenReady().then(async () => {
  await ensureDataRoot(getDataRoot())
  await createMainWindow()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
