import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

async function runGit(args, cwd) {
  return execFileAsync('git', args, {
    cwd,
    windowsHide: true,
  })
}

function normalizeText(value) {
  return value?.trim() || ''
}

export async function getGitStatus(repoPath) {
  if (!repoPath?.trim()) {
    return {
      ok: false,
      summary: 'Choose a repository folder first.',
      branch: '',
      clean: false,
    }
  }

  try {
    await runGit(['rev-parse', '--is-inside-work-tree'], repoPath)
    const { stdout } = await runGit(['status', '--short', '--branch'], repoPath)
    const summary = normalizeText(stdout)

    return {
      ok: true,
      summary: summary || 'Working tree clean.',
      branch: summary.split('\n')[0]?.replace(/^##\s*/, '') || 'unknown',
      clean: !summary.split('\n').slice(1).some(Boolean),
    }
  } catch (error) {
    return {
      ok: false,
      summary:
        normalizeText(error?.stderr) ||
        normalizeText(error?.stdout) ||
        error.message ||
        'Unable to read git status.',
      branch: '',
      clean: false,
    }
  }
}

export async function publishRepository({ repoPath, commitMessage, push }) {
  const statusBefore = await getGitStatus(repoPath)

  if (!statusBefore.ok) {
    return {
      ok: false,
      message: statusBefore.summary,
      status: statusBefore,
    }
  }

  try {
    await runGit(['add', '.'], repoPath)

    let committed = false
    try {
      await runGit(['commit', '-m', commitMessage], repoPath)
      committed = true
    } catch (error) {
      const combined = `${normalizeText(error?.stdout)}\n${normalizeText(error?.stderr)}`
      if (!combined.includes('nothing to commit')) {
        throw error
      }
    }

    let pushed = false
    if (push) {
      await runGit(['push'], repoPath)
      pushed = true
    }

    return {
      ok: true,
      message: pushed
        ? 'Changes committed and pushed.'
        : committed
          ? 'Changes committed locally.'
          : 'Nothing new to commit.',
      status: await getGitStatus(repoPath),
      committed,
      pushed,
    }
  } catch (error) {
    return {
      ok: false,
      message:
        normalizeText(error?.stderr) ||
        normalizeText(error?.stdout) ||
        error.message ||
        'Git publish failed.',
      status: await getGitStatus(repoPath),
    }
  }
}
