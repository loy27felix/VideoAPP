import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

const DEFAULT_WORKFLOW_STATUS = {
  script: 'ready',
  structure: 'planned',
  storyboard: 'planned',
  prompts: 'planned',
  canvas: 'planned',
  export: 'planned',
}

const DEFAULT_PROVIDER_PROFILES = [
  {
    id: 'provider-openai',
    label: 'Story Brain',
    vendor: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5.4',
    authentication: 'bring-your-own-key',
  },
  {
    id: 'provider-anthropic',
    label: 'Scene Refiner',
    vendor: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4.5',
    authentication: 'bring-your-own-key',
  },
  {
    id: 'provider-volcengine',
    label: 'China Fallback',
    vendor: 'Volcengine',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-seed-1-6-thinking',
    authentication: 'workspace-managed',
  },
]

function nowIso() {
  return new Date().toISOString()
}

function projectFolder(rootDir, projectId) {
  return resolve(rootDir, 'projects', projectId)
}

function projectFile(rootDir, projectId) {
  return resolve(projectFolder(rootDir, projectId), 'project.json')
}

async function writeJson(filePath, payload) {
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

function normalizeDuration(durationMinutes) {
  const numeric = Number(durationMinutes)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 6
  }

  return Math.max(1, Math.min(120, Math.round(numeric)))
}

function buildProject(input) {
  const timestamp = nowIso()

  return {
    id: `project_${randomUUID().slice(0, 8)}`,
    name: input.name.trim(),
    premise: input.premise.trim(),
    format: input.format.trim() || 'Narrative short',
    durationMinutes: normalizeDuration(input.durationMinutes),
    createdAt: timestamp,
    updatedAt: timestamp,
    workflowStatus: { ...DEFAULT_WORKFLOW_STATUS },
    providerProfiles: DEFAULT_PROVIDER_PROFILES.map((profile) => ({ ...profile })),
    exportTarget: {
      repoPath: '',
      assetRoot: 'studio-assets',
      branch: 'main',
      autoCommit: true,
      autoPush: false,
    },
  }
}

export async function ensureDataRoot(rootDir) {
  await mkdir(resolve(rootDir, 'projects'), { recursive: true })
}

export async function listProjects(rootDir) {
  await ensureDataRoot(rootDir)

  const entries = await readdir(resolve(rootDir, 'projects'), {
    withFileTypes: true,
  })

  const projects = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    try {
      const content = await readFile(projectFile(rootDir, entry.name), 'utf8')
      projects.push(JSON.parse(content))
    } catch {
      // Ignore malformed project folders so a bad file does not break the app.
    }
  }

  return projects.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export async function getProject(rootDir, projectId) {
  await ensureDataRoot(rootDir)
  const content = await readFile(projectFile(rootDir, projectId), 'utf8')
  return JSON.parse(content)
}

export async function createProject(rootDir, input) {
  if (!input?.name?.trim()) {
    throw new Error('Project name is required.')
  }

  const project = buildProject(input)
  await mkdir(projectFolder(rootDir, project.id), { recursive: true })
  await writeJson(projectFile(rootDir, project.id), project)

  return project
}

export async function updateProject(rootDir, projectId, patch) {
  const existing = await getProject(rootDir, projectId)

  const updated = {
    ...existing,
    name: patch.name?.trim() || existing.name,
    premise: typeof patch.premise === 'string' ? patch.premise : existing.premise,
    format: patch.format?.trim() || existing.format,
    durationMinutes:
      patch.durationMinutes === undefined
        ? existing.durationMinutes
        : normalizeDuration(patch.durationMinutes),
    providerProfiles: Array.isArray(patch.providerProfiles)
      ? patch.providerProfiles.map((profile) => ({ ...profile }))
      : existing.providerProfiles,
    exportTarget: patch.exportTarget
      ? {
          ...existing.exportTarget,
          ...patch.exportTarget,
        }
      : existing.exportTarget,
    workflowStatus: patch.workflowStatus
      ? {
          ...existing.workflowStatus,
          ...patch.workflowStatus,
        }
      : existing.workflowStatus,
    updatedAt: nowIso(),
  }

  await writeJson(projectFile(rootDir, projectId), updated)
  return updated
}
