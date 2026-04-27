import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function writeJson(filePath, payload) {
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

async function writeText(filePath, payload) {
  await writeFile(filePath, payload, 'utf8')
}

function buildStoryboardSkeleton(project) {
  const estimatedShots = Math.max(12, Math.round(project.durationMinutes * 4))

  return {
    projectId: project.id,
    estimatedShots,
    beats: [
      {
        id: 'beat-01',
        title: 'Hook',
        note: 'Define the opening image, emotional pressure, and audience question.',
      },
      {
        id: 'beat-02',
        title: 'Escalation',
        note: 'Translate structure into camera-friendly conflict and character action.',
      },
      {
        id: 'beat-03',
        title: 'Climax',
        note: 'Reserve the clearest visual turn for the strongest image sequence.',
      },
    ],
  }
}

export async function exportProjectToRepository(project) {
  const repoPath = project.exportTarget?.repoPath?.trim()

  if (!repoPath) {
    throw new Error('Choose a repository folder before exporting.')
  }

  const assetRoot = project.exportTarget?.assetRoot?.trim() || 'studio-assets'
  const projectSlug = slugify(project.name) || project.id
  const exportRoot = resolve(repoPath, assetRoot, projectSlug)

  const directories = [
    exportRoot,
    resolve(exportRoot, 'script'),
    resolve(exportRoot, 'storyboards'),
    resolve(exportRoot, 'prompts'),
    resolve(exportRoot, 'assets'),
    resolve(exportRoot, 'exports'),
  ]

  await Promise.all(directories.map((directory) => mkdir(directory, { recursive: true })))

  const files = [
    resolve(exportRoot, 'project.json'),
    resolve(exportRoot, 'README.md'),
    resolve(exportRoot, 'script', 'brief.md'),
    resolve(exportRoot, 'storyboards', 'storyboard.json'),
    resolve(exportRoot, 'prompts', 'provider-profiles.json'),
    resolve(exportRoot, 'assets', '.gitkeep'),
    resolve(exportRoot, 'exports', 'export-plan.md'),
  ]

  await Promise.all([
    writeJson(files[0], project),
    writeText(
      files[1],
      `# ${project.name}

${project.premise || 'No premise captured yet.'}

## Studio Notes

- Format: ${project.format}
- Planned runtime: ${project.durationMinutes} min
- Export root: ${assetRoot}/${projectSlug}
- Default branch: ${project.exportTarget.branch}
`,
    ),
    writeText(
      files[2],
      `# Story Brief

${project.premise || 'Use this file for your one-line concept, tone, and character intent.'}

## Production Direction

- Format: ${project.format}
- Runtime: ${project.durationMinutes} minutes
- Workflow owner: VideoAPP Studio
`,
    ),
    writeJson(files[3], buildStoryboardSkeleton(project)),
    writeJson(files[4], project.providerProfiles),
    writeText(files[5], ''),
    writeText(
      files[6],
      `# Export Plan

1. Lock the structured script.
2. Approve the storyboard beats.
3. Generate prompts and reference packs.
4. Produce final assets into the assets/ directory.
5. Commit and push the export to GitHub.
`,
    ),
  ])

  return {
    exportRoot,
    filesWritten: files,
  }
}
