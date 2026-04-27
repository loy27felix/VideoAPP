import { Octokit } from '@octokit/rest';
import { env } from './env';
import { supabaseAdmin } from './supabase-admin';

let client: Octokit | null = null;

function octokit(): Octokit {
  if (!client) {
    client = new Octokit({ auth: env.GITHUB_BOT_TOKEN });
  }

  return client;
}

export async function revertGithubCommit(
  badCommitSha: string,
  message: string,
): Promise<string> {
  const owner = env.GITHUB_REPO_OWNER;
  const repo = env.GITHUB_REPO_NAME;
  const branch = env.GITHUB_DEFAULT_BRANCH;
  const { data: badCommit } = await octokit().rest.git.getCommit({
    owner,
    repo,
    commit_sha: badCommitSha,
  });
  const parentSha = badCommit.parents[0]?.sha;

  if (!parentSha) {
    throw new Error('Cannot revert root commit');
  }

  const { data: parentCommit } = await octokit().rest.git.getCommit({
    owner,
    repo,
    commit_sha: parentSha,
  });
  const { data: head } = await octokit().rest.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });
  const { data: revertCommit } = await octokit().rest.git.createCommit({
    owner,
    repo,
    message,
    tree: parentCommit.tree.sha,
    parents: [head.object.sha],
  });

  await octokit().rest.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: revertCommit.sha,
  });

  return revertCommit.sha;
}

export async function markR2Orphans(
  orphans: { key: string; bytes?: number }[],
  reason: string,
): Promise<void> {
  for (const orphan of orphans) {
    await supabaseAdmin()
      .from('r2_orphans')
      .insert({
        storage_ref: orphan.key,
        bytes: orphan.bytes ?? null,
        reason,
      });
  }
}
