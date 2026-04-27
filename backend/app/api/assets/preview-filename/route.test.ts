import { beforeEach, describe, expect, it, vi } from 'vitest';

const EPISODE_ID = '11111111-1111-4111-8111-111111111111';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  selectAssetType: vi.fn(),
  selectEpisode: vi.fn(),
  selectCollision: vi.fn(),
}));

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    auth: { getUser: mocks.getUser },
    from: (table: string) => {
      if (table === 'asset_types') {
        return {
          select: () => ({
            eq: () => ({ single: async () => mocks.selectAssetType() }),
          }),
        };
      }

      if (table === 'episodes') {
        return {
          select: () => ({
            eq: () => ({ single: async () => mocks.selectEpisode() }),
          }),
        };
      }

      if (table === 'assets') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({ maybeSingle: async () => mocks.selectCollision() }),
              }),
            }),
          }),
        };
      }

      return {};
    },
  }),
}));

import { POST } from './route';

function makeReq(body: unknown) {
  return new Request('http://localhost/api/assets/preview-filename', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
    body: JSON.stringify(body),
  });
}

function episodeRow() {
  return {
    data: {
      episode_path: '童话剧_NA_侏儒怪',
      name_cn: '侏儒怪',
      contents: {
        name_cn: '侏儒怪',
        albums: { name_cn: 'NA', series: { name_cn: '童话剧' } },
      },
    },
    error: null,
  };
}

describe('POST /api/assets/preview-filename', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'u-1', email: 'a@beva.com' } },
      error: null,
    });
    mocks.selectEpisode.mockResolvedValue(episodeRow());
    mocks.selectCollision.mockResolvedValue({ data: null, error: null });
  });

  it('returns SCRIPT filename and GitHub storage ref', async () => {
    mocks.selectAssetType.mockResolvedValueOnce({
      data: {
        code: 'SCRIPT',
        folder_path: '02_Data/Script',
        filename_tpl: '{series}_{content}_SCRIPT',
        storage_ext: '.md',
        storage_backend: 'github',
      },
      error: null,
    });

    const res = await POST(
      makeReq({
        episode_id: EPISODE_ID,
        type_code: 'SCRIPT',
        name: '侏儒怪',
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.final_filename).toBe('童话剧_侏儒怪_SCRIPT.md');
    expect(body.data.storage_ref).toBe('童话剧_NA_侏儒怪/02_Data/Script/童话剧_侏儒怪_SCRIPT.md');
    expect(body.data.storage_backend).toBe('github');
  });

  it('400 when keep_as_is needs original filename but absent', async () => {
    mocks.selectAssetType.mockResolvedValueOnce({
      data: {
        code: 'CHAR',
        folder_path: '02_Data/Assets/Characters',
        filename_tpl: '{content}_CHAR_{name}_{variant}_v{version:03}',
        storage_ext: 'keep_as_is',
        storage_backend: 'r2',
      },
      error: null,
    });

    const res = await POST(
      makeReq({
        episode_id: EPISODE_ID,
        type_code: 'CHAR',
        name: '主角',
        version: 1,
      }),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('PAYLOAD_MALFORMED');
  });

  it('returns collision when filename already pushed', async () => {
    mocks.selectAssetType.mockResolvedValueOnce({
      data: {
        code: 'SCRIPT',
        folder_path: '02_Data/Script',
        filename_tpl: '{series}_{content}_SCRIPT',
        storage_ext: '.md',
        storage_backend: 'github',
      },
      error: null,
    });
    mocks.selectCollision.mockResolvedValueOnce({
      data: { id: 'asset-1', version: 1 },
      error: null,
    });

    const res = await POST(
      makeReq({
        episode_id: EPISODE_ID,
        type_code: 'SCRIPT',
        name: '侏儒怪',
      }),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).data.collision).toEqual({
      existing_asset_id: 'asset-1',
      existing_version: 1,
    });
  });
});
