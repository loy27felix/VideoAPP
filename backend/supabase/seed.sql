insert into public.asset_types
  (code, name_cn, icon, folder_path, filename_tpl, file_exts, storage_ext, storage_backend, parent_panel, needs_before, supports_paste, allow_ai_generate, sort_order, enabled)
values
  ('SCRIPT', '剧本', '📝', '02_Data/Script',
   '{series}_{content}_SCRIPT',
   array['.docx','.md','.txt'], '.md', 'github', null, null, true, false, 10, true),

  ('PROMPT_IMG', '分镜图提示词', '🖼️', '02_Data/Prompt/Image',
   '{series}_{content}_PROMPT_IMG_{number:03}',
   array['.md','.txt','.xlsx'], '.md', 'github', '分镜', array['SCRIPT'], true, false, 20, true),

  ('PROMPT_VID', '分镜视频提示词', '🎞️', '02_Data/Prompt/Video',
   '{series}_{content}_PROMPT_VID_{number:03}',
   array['.md','.txt','.xlsx'], '.md', 'github', '分镜', array['SCRIPT'], true, false, 21, true),

  ('SHOT_IMG', '分镜图', '🖼️', '02_Data/Shot/{episode}/Images',
   '{episode}_SHOT_{number:03}_v{version:03}',
   array['.png','.jpg','.jpeg','.webp'], 'keep_as_is', 'r2', '分镜', array['PROMPT_IMG'], false, false, 22, true),

  ('SHOT_VID', '分镜视频', '🎬', '02_Data/Shot/{episode}/Videos',
   '{episode}_SHOT_{number:03}_v{version:03}',
   array['.mp4','.mov','.webm'], 'keep_as_is', 'r2', '分镜', array['PROMPT_VID','SHOT_IMG'], false, false, 23, true),

  ('CHAR', '角色', '👤', '02_Data/Assets/Characters',
   '{content}_CHAR_{name}_{variant}_v{version:03}',
   array['.png','.jpg','.jpeg','.webp'], 'keep_as_is', 'r2', '视觉资产', null, false, false, 30, true),

  ('PROP', '道具', '🎒', '02_Data/Assets/Props',
   '{content}_PROP_{name}_{variant}_v{version:03}',
   array['.png','.jpg','.jpeg','.webp'], 'keep_as_is', 'r2', '视觉资产', null, false, false, 31, true),

  ('SCENE', '场景', '🏞️', '02_Data/Assets/Scenes',
   '{content}_SCENE_{name}_{variant}_v{version:03}',
   array['.png','.jpg','.jpeg','.webp'], 'keep_as_is', 'r2', '视觉资产', null, false, false, 32, true),

  ('DIALOG', '对白', '💬', '02_Data/Audio/Dialog',
   '{episode}_DIALOG_{number:03}_{language}',
   array['.mp3','.wav','.m4a'], 'keep_as_is', 'r2', '音频', array['SCRIPT'], false, false, 40, false),

  ('BGM', '配乐', '🎵', '02_Data/Audio/BGM',
   '{episode}_BGM_{number:03}_{name}',
   array['.mp3','.wav'], 'keep_as_is', 'r2', '音频', null, false, false, 41, false),

  ('SONG', '歌曲', '🎤', '02_Data/Audio/Song',
   '{episode}_SONG_{number:03}_{name}',
   array['.mp3','.wav'], 'keep_as_is', 'r2', '音频', null, false, false, 42, false),

  ('SFX', '音效', '🔊', '02_Data/Audio/SFX',
   '{episode}_SFX_{number:03}_{name}',
   array['.mp3','.wav'], 'keep_as_is', 'r2', '音频', null, false, false, 43, false)
on conflict (code) do update set
  name_cn = excluded.name_cn,
  icon = excluded.icon,
  folder_path = excluded.folder_path,
  filename_tpl = excluded.filename_tpl,
  file_exts = excluded.file_exts,
  storage_ext = excluded.storage_ext,
  storage_backend = excluded.storage_backend,
  parent_panel = excluded.parent_panel,
  needs_before = excluded.needs_before,
  supports_paste = excluded.supports_paste,
  allow_ai_generate = excluded.allow_ai_generate,
  sort_order = excluded.sort_order,
  enabled = excluded.enabled;
