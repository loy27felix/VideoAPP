import { beforeEach, describe, expect, it, vi } from 'vitest';

const githubMock = vi.hoisted(() => ({
  getRef: vi.fn(),
  getCommit: vi.fn(),
  createCommit: vi.fn(),
  updateRef: vi.fn(),
}));
const supaInsert = vi.hoisted(() => vi.fn());

vi.mock('@octokit/rest', () => ({
  Octokit: class {
    rest = { git: githubMock };
  },
}));
vi.mock('./supabase-admin', () => ({
  supabaseAdmin: () => ({ from: () => ({ insert: supaInsert }) }),
}));

import { markR2Orphans, revertGithubCommit } from './compensation';

describe('revertGithubCommit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a revert commit on top of HEAD using parent tree', async () => {
    githubMock.getCommit
      .mockResolvedValueOnce({
        data: { tree: { sha: 'bad-tree' }, parents: [{ sha: 'prev' }] },
      })
      .mockResolvedValueOnce({
        data: { tree: { sha: 'parent-tree' }, parents: [{ sha: 'older' }] },
      });
    githubMock.getRef.mockResolvedValueOnce({ data: { object: { sha: 'head' } } });
    githubMock.createCommit.mockResolvedValueOnce({ data: { sha: 'rev-sha' } });
    githubMock.updateRef.mockResolvedValueOnce({ data: {} });

    const sha = await revertGithubCommit('bad-commit', 'revert: failed push');

    expect(sha).toBe('rev-sha');
    expect(githubMock.createCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'revert: failed push',
        tree: 'parent-tree',
        parents: ['head'],
      }),
    );
  });
});

describe('markR2Orphans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts one row per orphan key', async () => {
    supaInsert.mockResolvedValue({ error: null });

    await markR2Orphans(
      [
        { key: 'a', bytes: 100 },
        { key: 'b', bytes: 200 },
      ],
      'push aborted',
    );

    expect(supaInsert).toHaveBeenCalledTimes(2);
  });
});
