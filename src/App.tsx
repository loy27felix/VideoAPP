import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type {
  AppBootstrap,
  CreateProjectInput,
  ExportResult,
  GitStatusResult,
  ProjectRecord,
  ProviderProfile,
  PublishResult,
} from './types'

const EMPTY_PROJECT_FORM: CreateProjectInput = {
  name: '',
  premise: '',
  format: 'Narrative short',
  durationMinutes: 6,
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function App() {
  const [boot, setBoot] = useState<AppBootstrap | null>(null)
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [projectDraft, setProjectDraft] = useState<ProjectRecord | null>(null)
  const [newProject, setNewProject] = useState<CreateProjectInput>(EMPTY_PROJECT_FORM)
  const [gitStatus, setGitStatus] = useState<GitStatusResult | null>(null)
  const [statusMessage, setStatusMessage] = useState('Loading studio...')
  const [busy, setBusy] = useState(false)

  async function refreshProjects(nextSelectedId?: string) {
    const snapshot = await window.videoApp.bootstrap()
    setBoot(snapshot)
    setProjects(snapshot.projects)

    const selectedId = nextSelectedId ?? selectedProjectId ?? snapshot.projects[0]?.id ?? null

    setSelectedProjectId(selectedId)

    if (selectedId) {
      const fresh = await window.videoApp.getProject(selectedId)
      setProjectDraft(fresh)
    } else {
      setProjectDraft(null)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshProjects()
    }, 0)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const projectCountLabel = useMemo(() => {
    if (projects.length === 1) {
      return '1 active studio project'
    }

    return `${projects.length} active studio projects`
  }, [projects.length])

  const exportPreview = useMemo(() => {
    if (!projectDraft) {
      return []
    }

    const repoPath = projectDraft.exportTarget.repoPath || 'D:\\Repos\\YourStudioRepo'
    const assetRoot = projectDraft.exportTarget.assetRoot || 'studio-assets'
    const slug = slugify(projectDraft.name) || projectDraft.id

    return [
      `${repoPath}\\${assetRoot}\\${slug}\\project.json`,
      `${repoPath}\\${assetRoot}\\${slug}\\script\\brief.md`,
      `${repoPath}\\${assetRoot}\\${slug}\\storyboards\\storyboard.json`,
      `${repoPath}\\${assetRoot}\\${slug}\\prompts\\provider-profiles.json`,
      `${repoPath}\\${assetRoot}\\${slug}\\assets\\.gitkeep`,
    ]
  }, [projectDraft])

  async function handleProjectSelect(projectId: string) {
    setSelectedProjectId(projectId)
    setGitStatus(null)
    const fresh = await window.videoApp.getProject(projectId)
    setProjectDraft(fresh)
    setStatusMessage(`Loaded ${fresh.name}.`)
  }

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!newProject.name.trim()) {
      setStatusMessage('Give the new project a clear working title first.')
      return
    }

    setBusy(true)
    try {
      const created = await window.videoApp.createProject(newProject)
      setNewProject(EMPTY_PROJECT_FORM)
      await refreshProjects(created.id)
      setStatusMessage(`Created ${created.name}.`)
    } finally {
      setBusy(false)
    }
  }

  function updateDraft<K extends keyof ProjectRecord>(key: K, value: ProjectRecord[K]) {
    if (!projectDraft) {
      return
    }

    setProjectDraft({
      ...projectDraft,
      [key]: value,
    })
  }

  function updateExportTarget(
    key: keyof ProjectRecord['exportTarget'],
    value: string | boolean,
  ) {
    if (!projectDraft) {
      return
    }

    setProjectDraft({
      ...projectDraft,
      exportTarget: {
        ...projectDraft.exportTarget,
        [key]: value,
      },
    })
  }

  function updateProviderProfile(
    providerId: string,
    key: keyof ProviderProfile,
    value: string,
  ) {
    if (!projectDraft) {
      return
    }

    setProjectDraft({
      ...projectDraft,
      providerProfiles: projectDraft.providerProfiles.map((profile) =>
        profile.id === providerId ? { ...profile, [key]: value } : profile,
      ),
    })
  }

  async function persistDraft() {
    if (!projectDraft) {
      return null
    }

    setBusy(true)
    try {
      const saved = await window.videoApp.updateProject(projectDraft.id, {
        name: projectDraft.name,
        premise: projectDraft.premise,
        format: projectDraft.format,
        durationMinutes: projectDraft.durationMinutes,
        providerProfiles: projectDraft.providerProfiles,
        exportTarget: projectDraft.exportTarget,
        workflowStatus: projectDraft.workflowStatus,
      })

      setProjectDraft(saved)
      setProjects((current) =>
        current
          .map((project) => (project.id === saved.id ? saved : project))
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
      )
      setStatusMessage(`Saved ${saved.name}.`)

      return saved
    } finally {
      setBusy(false)
    }
  }

  async function chooseRepositoryFolder() {
    if (!projectDraft) {
      return
    }

    const folder = await window.videoApp.pickDirectory()
    if (!folder) {
      return
    }

    updateExportTarget('repoPath', folder)
    setStatusMessage(`Repository folder selected: ${folder}`)
  }

  async function checkGitStatus() {
    if (!projectDraft?.exportTarget.repoPath) {
      setStatusMessage('Choose a repository folder before checking git status.')
      return
    }

    const result = await window.videoApp.getGitStatus(projectDraft.exportTarget.repoPath)
    setGitStatus(result)
    setStatusMessage(result.summary)
  }

  async function handleExportToRepo() {
    if (!projectDraft) {
      return
    }

    const saved = await persistDraft()
    if (!saved) {
      return
    }

    setBusy(true)
    try {
      const result: ExportResult = await window.videoApp.exportProjectToRepo(saved.id)
      setStatusMessage(`Exported studio snapshot to ${result.exportRoot}`)
      await checkGitStatus()
    } finally {
      setBusy(false)
    }
  }

  async function handlePublish(push: boolean) {
    if (!projectDraft?.exportTarget.repoPath) {
      setStatusMessage('Choose a repository folder before publishing.')
      return
    }

    const commitMessage = `chore: sync ${projectDraft.name} studio export`
    setBusy(true)
    try {
      const result: PublishResult = await window.videoApp.publishRepository({
        repoPath: projectDraft.exportTarget.repoPath,
        commitMessage,
        push,
      })
      setGitStatus(result.status)
      setStatusMessage(result.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="workspace-shell">
      <aside className="sidebar-panel">
        <div className="brand-lockup">
          <p className="eyebrow">Editorial Pipeline</p>
          <h1>VideoAPP Studio</h1>
          <p className="lede">
            A Windows production desk for script architecture, storyboard planning,
            asset packaging, and GitHub-controlled delivery.
          </p>
        </div>

        <section className="panel-block">
          <div className="section-heading">
            <h2>Projects</h2>
            <span>{projectCountLabel}</span>
          </div>

          <div className="project-list">
            {projects.length === 0 ? (
              <p className="muted-card">
                No projects yet. Create your first short-form production workspace.
              </p>
            ) : (
              projects.map((project) => (
                <button
                  key={project.id}
                  className={`project-card ${selectedProjectId === project.id ? 'selected' : ''}`}
                  onClick={() => void handleProjectSelect(project.id)}
                  type="button"
                >
                  <strong>{project.name}</strong>
                  <span>{project.format}</span>
                  <span>{project.durationMinutes} min</span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="panel-block">
          <div className="section-heading">
            <h2>New Project</h2>
            <span>Step 1</span>
          </div>

          <form className="stack-form" onSubmit={handleCreateProject}>
            <label>
              Project title
              <input
                value={newProject.name}
                onChange={(event) =>
                  setNewProject((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Rumpelstiltskin pilot"
              />
            </label>

            <label>
              One-line premise
              <textarea
                rows={4}
                value={newProject.premise}
                onChange={(event) =>
                  setNewProject((current) => ({
                    ...current,
                    premise: event.target.value,
                  }))
                }
                placeholder="A fairy tale gets rebuilt into a kinetic AI comic short."
              />
            </label>

            <div className="dual-grid">
              <label>
                Format
                <select
                  value={newProject.format}
                  onChange={(event) =>
                    setNewProject((current) => ({
                      ...current,
                      format: event.target.value,
                    }))
                  }
                >
                  <option>Narrative short</option>
                  <option>Concept short</option>
                  <option>Pilot episode</option>
                </select>
              </label>

              <label>
                Runtime
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={newProject.durationMinutes}
                  onChange={(event) =>
                    setNewProject((current) => ({
                      ...current,
                      durationMinutes: Number(event.target.value) || 1,
                    }))
                  }
                />
              </label>
            </div>

            <button className="accent-button" disabled={busy} type="submit">
              Create Workspace
            </button>
          </form>
        </section>
      </aside>

      <main className="studio-panel">
        <header className="hero-panel">
          <div>
            <p className="eyebrow">Production Command Deck</p>
            <h2>{projectDraft ? projectDraft.name : 'Select or create a project'}</h2>
            <p className="lede">
              {projectDraft
                ? projectDraft.premise || 'Capture the premise, tone, and visual promise of this project.'
                : 'This first build gives us local projects, provider presets, repository export, and Git publishing hooks.'}
            </p>
          </div>

          <div className="status-badge">
            <span>Last signal</span>
            <strong>{statusMessage}</strong>
          </div>
        </header>

        {!projectDraft ? (
          <section className="empty-stage">
            <p>Create a project in the left rail to unlock the story, asset, and Git pipeline.</p>
          </section>
        ) : (
          <div className="content-grid">
            <section className="editorial-column">
              <div className="section-heading">
                <h2>Story Workspace</h2>
                <span>Step 2</span>
              </div>

              <div className="detail-card">
                <label>
                  Working title
                  <input
                    value={projectDraft.name}
                    onChange={(event) => updateDraft('name', event.target.value)}
                  />
                </label>

                <div className="dual-grid">
                  <label>
                    Format
                    <input
                      value={projectDraft.format}
                      onChange={(event) => updateDraft('format', event.target.value)}
                    />
                  </label>

                  <label>
                    Duration (minutes)
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={projectDraft.durationMinutes}
                      onChange={(event) =>
                        updateDraft('durationMinutes', Number(event.target.value) || 1)
                      }
                    />
                  </label>
                </div>

                <label>
                  Premise and directing thesis
                  <textarea
                    rows={6}
                    value={projectDraft.premise}
                    onChange={(event) => updateDraft('premise', event.target.value)}
                  />
                </label>

                <button className="ghost-button" disabled={busy} onClick={() => void persistDraft()} type="button">
                  Save Workspace Draft
                </button>
              </div>

              <div className="section-heading">
                <h2>Workflow Steps</h2>
                <span>Core system</span>
              </div>

              <div className="workflow-grid">
                {boot?.workflowSteps.map((step) => (
                  <article key={step.id} className="workflow-card">
                    <header>
                      <span>{step.id.toUpperCase()}</span>
                      <strong>{projectDraft.workflowStatus[step.id]}</strong>
                    </header>
                    <h3>{step.label}</h3>
                    <p>
                      {step.id === 'script' &&
                        'Generate the premise, genre promise, and bounded runtime target.'}
                      {step.id === 'structure' &&
                        'Lock the three-act spine, backstory, and character arcs before visuals.'}
                      {step.id === 'storyboard' &&
                        'Turn beats into shot-ready cards with duration, blocking, and staging.'}
                      {step.id === 'prompts' &&
                        'Convert every approved frame into provider-aware image and video prompts.'}
                      {step.id === 'canvas' &&
                        'Store reference art, character packs, and versioned scene assets.'}
                      {step.id === 'export' &&
                        'Publish the asset bundle into a Git-managed repository for the team.'}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="systems-column">
              <div className="section-heading">
                <h2>Provider Routing</h2>
                <span>BYOK-ready</span>
              </div>

              <div className="provider-stack">
                {projectDraft.providerProfiles.map((profile) => (
                  <article key={profile.id} className="provider-card">
                    <div className="provider-header">
                      <strong>{profile.label}</strong>
                      <span>{profile.authentication}</span>
                    </div>

                    <div className="dual-grid">
                      <label>
                        Vendor
                        <select
                          value={profile.vendor}
                          onChange={(event) =>
                            updateProviderProfile(profile.id, 'vendor', event.target.value)
                          }
                        >
                          {boot?.providerCatalog.map((vendor) => (
                            <option key={vendor}>{vendor}</option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Model
                        <input
                          value={profile.model}
                          onChange={(event) =>
                            updateProviderProfile(profile.id, 'model', event.target.value)
                          }
                        />
                      </label>
                    </div>

                    <label>
                      Base URL
                      <input
                        value={profile.baseUrl}
                        onChange={(event) =>
                          updateProviderProfile(profile.id, 'baseUrl', event.target.value)
                        }
                      />
                    </label>
                  </article>
                ))}
              </div>
            </section>

            <section className="delivery-column">
              <div className="section-heading">
                <h2>Repository Delivery</h2>
                <span>Step 3</span>
              </div>

              <div className="detail-card">
                <label>
                  Git repository folder
                  <div className="inline-action">
                    <input
                      readOnly
                      value={projectDraft.exportTarget.repoPath}
                      placeholder="Pick a local clone of your GitHub repository"
                    />
                    <button className="ghost-button" onClick={() => void chooseRepositoryFolder()} type="button">
                      Choose
                    </button>
                  </div>
                </label>

                <div className="dual-grid">
                  <label>
                    Asset root inside repo
                    <input
                      value={projectDraft.exportTarget.assetRoot}
                      onChange={(event) => updateExportTarget('assetRoot', event.target.value)}
                    />
                  </label>

                  <label>
                    Default branch
                    <input
                      value={projectDraft.exportTarget.branch}
                      onChange={(event) => updateExportTarget('branch', event.target.value)}
                    />
                  </label>
                </div>

                <div className="toggle-row">
                  <label className="checkbox">
                    <input
                      checked={projectDraft.exportTarget.autoCommit}
                      onChange={(event) =>
                        updateExportTarget('autoCommit', event.target.checked)
                      }
                      type="checkbox"
                    />
                    Auto-commit after export
                  </label>

                  <label className="checkbox">
                    <input
                      checked={projectDraft.exportTarget.autoPush}
                      onChange={(event) =>
                        updateExportTarget('autoPush', event.target.checked)
                      }
                      type="checkbox"
                    />
                    Auto-push after commit
                  </label>
                </div>

                <div className="button-row">
                  <button className="accent-button" disabled={busy} onClick={() => void handleExportToRepo()} type="button">
                    Export Studio Snapshot
                  </button>
                  <button className="ghost-button" onClick={() => void checkGitStatus()} type="button">
                    Check Git Status
                  </button>
                </div>

                <div className="button-row">
                  <button className="ghost-button" disabled={busy} onClick={() => void handlePublish(false)} type="button">
                    Commit Locally
                  </button>
                  <button className="accent-button" disabled={busy} onClick={() => void handlePublish(true)} type="button">
                    Commit and Push
                  </button>
                </div>
              </div>

              <div className="detail-card">
                <div className="section-heading compact">
                  <h2>Export Preview</h2>
                  <span>{projectDraft.updatedAt ? formatDate(projectDraft.updatedAt) : ''}</span>
                </div>

                <div className="preview-list">
                  {exportPreview.map((entry) => (
                    <code key={entry}>{entry}</code>
                  ))}
                </div>
              </div>

              <div className="detail-card">
                <div className="section-heading compact">
                  <h2>Git Signal</h2>
                  <span>{gitStatus?.branch || 'Not checked yet'}</span>
                </div>
                <pre className="git-console">
                  {gitStatus?.summary || 'Pick a repository and export once to see pending changes.'}
                </pre>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
