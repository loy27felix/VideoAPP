export type WorkflowStepId =
  | 'script'
  | 'structure'
  | 'storyboard'
  | 'prompts'
  | 'canvas'
  | 'export'

export type WorkflowState = 'ready' | 'planned' | 'in-progress' | 'review' | 'done'

export interface ProviderProfile {
  id: string
  label: string
  vendor: string
  baseUrl: string
  model: string
  authentication: string
}

export interface ExportTarget {
  repoPath: string
  assetRoot: string
  branch: string
  autoCommit: boolean
  autoPush: boolean
}

export interface ProjectRecord {
  id: string
  name: string
  premise: string
  format: string
  durationMinutes: number
  createdAt: string
  updatedAt: string
  providerProfiles: ProviderProfile[]
  exportTarget: ExportTarget
  workflowStatus: Record<WorkflowStepId, WorkflowState>
}

export interface CreateProjectInput {
  name: string
  premise: string
  format: string
  durationMinutes: number
}

export interface AppBootstrap {
  dataRoot: string
  workflowSteps: Array<{
    id: WorkflowStepId
    label: string
  }>
  providerCatalog: string[]
  projects: ProjectRecord[]
}

export interface GitStatusResult {
  ok: boolean
  summary: string
  branch: string
  clean: boolean
}

export interface ExportResult {
  exportRoot: string
  filesWritten: string[]
}

export interface PublishResult {
  ok: boolean
  message: string
  status: GitStatusResult
  committed?: boolean
  pushed?: boolean
}
