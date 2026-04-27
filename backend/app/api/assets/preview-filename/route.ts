export const runtime = 'edge';

import { z } from 'zod';
import { err, ok } from '@/lib/api-response';
import { requireUser } from '@/lib/auth-guard';
import {
  MissingTemplateVarError,
  OriginalFilenameRequiredError,
  resolveFilename,
} from '@/lib/filename-resolver';
import { composeFolderPath, composeFullStorageRef } from '@/lib/path';
import { supabaseAdmin } from '@/lib/supabase-admin';

const bodySchema = z.object({
  episode_id: z.uuid(),
  type_code: z.string().min(1),
  name: z.string().optional(),
  variant: z.string().optional(),
  number: z.number().int().nonnegative().optional(),
  version: z.number().int().min(1).default(1),
  stage: z.enum(['ROUGH', 'REVIEW', 'FINAL']).default('ROUGH'),
  language: z.string().regex(/^[A-Z]{2}$/).default('ZH'),
  original_filename: z.string().optional(),
});

interface AssetTypeRow {
  code: string;
  folder_path: string;
  filename_tpl: string;
  storage_ext: string;
  storage_backend: string;
}

interface EpisodeRow {
  episode_path: string;
  name_cn: string;
  contents?: {
    name_cn?: string;
    albums?: {
      name_cn?: string;
      series?: {
        name_cn?: string;
      };
    };
  };
}

interface CollisionRow {
  id: string;
  version: number;
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireUser(req);

  if (auth instanceof Response) {
    return auth;
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return err('PAYLOAD_MALFORMED', 'Body must be JSON', undefined, 400);
  }

  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return err('PAYLOAD_MALFORMED', parsed.error.issues[0]?.message ?? 'Invalid payload', undefined, 400);
  }

  const admin = supabaseAdmin();
  const { data: assetType, error: assetTypeError } = await admin
    .from('asset_types')
    .select('code,folder_path,filename_tpl,storage_ext,storage_backend')
    .eq('code', parsed.data.type_code)
    .single<AssetTypeRow>();

  if (assetTypeError || !assetType) {
    return err('PAYLOAD_MALFORMED', `Unknown type_code ${parsed.data.type_code}`, undefined, 400);
  }

  const { data: episode, error: episodeError } = await admin
    .from('episodes')
    .select(
      `episode_path,name_cn,
      contents:content_id ( name_cn, albums:album_id ( name_cn, series:series_id ( name_cn ) ) )`,
    )
    .eq('id', parsed.data.episode_id)
    .single<EpisodeRow>();

  if (episodeError || !episode) {
    return err('PAYLOAD_MALFORMED', 'Episode not found', undefined, 404);
  }

  let finalFilename: string;

  try {
    finalFilename = resolveFilename({
      template: assetType.filename_tpl,
      series: episode.contents?.albums?.series?.name_cn,
      album: episode.contents?.albums?.name_cn,
      content: episode.contents?.name_cn,
      episode: episode.name_cn,
      name: parsed.data.name,
      variant: parsed.data.variant,
      number: parsed.data.number,
      version: parsed.data.version,
      language: parsed.data.language,
      storageExt: assetType.storage_ext,
      originalFilename: parsed.data.original_filename,
    });
  } catch (error) {
    if (error instanceof OriginalFilenameRequiredError || error instanceof MissingTemplateVarError) {
      return err('PAYLOAD_MALFORMED', (error as Error).message, { code: error.code }, 400);
    }

    return err('PAYLOAD_MALFORMED', (error as Error).message, undefined, 400);
  }

  const folderPath = composeFolderPath({
    template: assetType.folder_path,
    episode: episode.name_cn,
    content: episode.contents?.name_cn,
  });
  const storageRef = composeFullStorageRef({
    episodePath: episode.episode_path,
    folderPath,
    finalFilename,
  });
  const { data: collision } = await admin
    .from('assets')
    .select('id,version')
    .eq('episode_id', parsed.data.episode_id)
    .eq('final_filename', finalFilename)
    .eq('status', 'pushed')
    .maybeSingle<CollisionRow>();

  return ok({
    final_filename: finalFilename,
    storage_backend: assetType.storage_backend,
    storage_ref: storageRef,
    collision: collision
      ? {
          existing_asset_id: collision.id,
          existing_version: collision.version,
        }
      : undefined,
  });
}
