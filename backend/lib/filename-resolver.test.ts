import { describe, expect, it } from 'vitest';
import {
  InvalidNameError,
  MissingTemplateVarError,
  OriginalFilenameRequiredError,
  composeEpisodePath,
  normalize,
  resolveFilename,
} from './filename-resolver';

describe('normalize', () => {
  it('keeps valid Chinese names', () => {
    expect(normalize('童话剧')).toBe('童话剧');
  });

  it('replaces spaces and path separators with a single underscore', () => {
    expect(normalize('  侏儒怪 / 第一集  ')).toBe('侏儒怪_第一集');
  });

  it('removes full-width punctuation at the edges', () => {
    expect(normalize('《侏儒怪》！')).toBe('侏儒怪');
  });

  it('collapses repeated underscores', () => {
    expect(normalize('a___b')).toBe('a_b');
  });

  it('throws InvalidNameError when the name is empty', () => {
    expect(() => normalize('')).toThrow(InvalidNameError);
  });

  it('truncates to 64 character units', () => {
    expect(normalize('x'.repeat(100))).toHaveLength(64);
  });
});

describe('composeEpisodePath', () => {
  it('joins normalized series, album, and content names', () => {
    expect(
      composeEpisodePath({
        series: '童话剧',
        album: 'NA',
        content: '侏儒怪',
      }),
    ).toBe('童话剧_NA_侏儒怪');
  });
});

describe('resolveFilename', () => {
  it('resolves SCRIPT template with markdown storage extension', () => {
    expect(
      resolveFilename({
        template: '{series}_{content}_SCRIPT',
        series: '童话剧',
        content: '侏儒怪',
        storageExt: '.md',
      }),
    ).toBe('童话剧_侏儒怪_SCRIPT.md');
  });

  it('resolves SHOT_IMG template and keeps original extension', () => {
    expect(
      resolveFilename({
        template: '{episode}_SHOT_{number:03}_v{version:03}',
        episode: '侏儒怪',
        number: 1,
        version: 2,
        storageExt: 'keep_as_is',
        originalFilename: 'draft.png',
      }),
    ).toBe('侏儒怪_SHOT_001_v002.png');
  });

  it('resolves CHAR template with variant', () => {
    expect(
      resolveFilename({
        template: '{content}_CHAR_{name}_{variant}_v{version:03}',
        content: '侏儒怪',
        name: '主角',
        variant: '白天',
        version: 1,
        storageExt: 'keep_as_is',
        originalFilename: 'role.PNG',
      }),
    ).toBe('侏儒怪_CHAR_主角_白天_v001.png');
  });

  it('collapses empty optional variant in CHAR template', () => {
    expect(
      resolveFilename({
        template: '{content}_CHAR_{name}_{variant}_v{version:03}',
        content: '侏儒怪',
        name: '主角',
        version: 1,
        storageExt: 'keep_as_is',
        originalFilename: 'role.png',
      }),
    ).toBe('侏儒怪_CHAR_主角_v001.png');
  });

  it('throws when keep_as_is has no original filename', () => {
    expect(() =>
      resolveFilename({
        template: '{episode}_SHOT_{number:03}_v{version:03}',
        episode: '侏儒怪',
        number: 1,
        version: 2,
        storageExt: 'keep_as_is',
      }),
    ).toThrow(OriginalFilenameRequiredError);
  });

  it('throws when a required template variable is missing', () => {
    expect(() =>
      resolveFilename({
        template: '{series}_{content}_SCRIPT',
        series: '童话剧',
        storageExt: '.md',
      }),
    ).toThrow(MissingTemplateVarError);
  });
});
