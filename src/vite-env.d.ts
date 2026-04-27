/// <reference types="vite/client" />

import type {
  AppBootstrap,
  CreateProjectInput,
  ExportResult,
  GitStatusResult,
  ProjectRecord,
  PublishResult,
} from './types'

interface PublishPayload {
  repoPath: string
  commitMessage: string
  push: boolean
}

interface VideoAppBridge {
  bootstrap: () => Promise<AppBootstrap>
  createProject: (input: CreateProjectInput) => Promise<ProjectRecord>
  getProject: (projectId: string) => Promise<ProjectRecord>
  updateProject: (
    projectId: string,
    patch: Partial<ProjectRecord>,
  ) => Promise<ProjectRecord>
  pickDirectory: () => Promise<string>
  exportProjectToRepo: (projectId: string) => Promise<ExportResult>
  getGitStatus: (repoPath: string) => Promise<GitStatusResult>
  publishRepository: (payload: PublishPayload) => Promise<PublishResult>
}

declare global {
  interface Window {
    videoApp: VideoAppBridge
  }
}

export {}
