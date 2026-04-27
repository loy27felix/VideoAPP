export class InvalidNameError extends Error {
  code = 'InvalidNameError' as const;

  constructor(message = 'Name becomes empty after normalization') {
    super(message);
    this.name = 'InvalidNameError';
    Object.setPrototypeOf(this, InvalidNameError.prototype);
  }
}

export class MissingTemplateVarError extends Error {
  code = 'MissingTemplateVarError' as const;

  constructor(variable: string) {
    super(`Missing required template variable: ${variable}`);
    this.name = 'MissingTemplateVarError';
    Object.setPrototypeOf(this, MissingTemplateVarError.prototype);
  }
}

export class OriginalFilenameRequiredError extends Error {
  code = 'OriginalFilenameRequiredError' as const;

  constructor() {
    super('originalFilename is required when storageExt is keep_as_is');
    this.name = 'OriginalFilenameRequiredError';
    Object.setPrototypeOf(this, OriginalFilenameRequiredError.prototype);
  }
}

interface ResolveFilenameOpts {
  template: string;
  series?: string;
  album?: string;
  content?: string;
  episode?: string;
  name?: string;
  variant?: string;
  number?: number;
  version?: number;
  language?: string;
  storageExt: string;
  originalFilename?: string;
}

const ILLEGAL_NAME_CHARS = /[ /\\:*?"<>|!《》！？（）【】：；，""''“”‘’\r\n\t]+/g;
const TEMPLATE_VAR_PATTERN = /\{([a-z]+)(?::(\d+))?\}/g;

function truncateGraphemes(value: string, maxLength: number): string {
  if ('Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(value), (part) => part.segment)
      .slice(0, maxLength)
      .join('');
  }

  return Array.from(value).slice(0, maxLength).join('');
}

function collapseAndTrimUnderscores(value: string): string {
  return value.replace(/_+/g, '_').replace(/^_+|_+$/g, '').trim();
}

export function normalize(input: string): string {
  const normalized = input
    .normalize('NFKC')
    .replace(/\u3000/g, ' ')
    .replace(ILLEGAL_NAME_CHARS, '_');
  const collapsed = collapseAndTrimUnderscores(normalized);
  const truncated = truncateGraphemes(collapsed, 64);
  const result = collapseAndTrimUnderscores(truncated);

  if (!result) {
    throw new InvalidNameError();
  }

  return result;
}

export function composeEpisodePath(opts: {
  series: string;
  album: string;
  content: string;
}): string {
  return `${normalize(opts.series)}_${normalize(opts.album)}_${normalize(opts.content)}`;
}

function requireTextVar(
  variable: 'series' | 'album' | 'content' | 'episode' | 'name',
  opts: ResolveFilenameOpts,
): string {
  const value = opts[variable];

  if (value === undefined || value.trim() === '') {
    throw new MissingTemplateVarError(variable);
  }

  return normalize(value);
}

function resolveTextVar(variable: string, opts: ResolveFilenameOpts): string {
  if (variable === 'variant') {
    return opts.variant?.trim() ? normalize(opts.variant) : '';
  }

  if (
    variable === 'series' ||
    variable === 'album' ||
    variable === 'content' ||
    variable === 'episode' ||
    variable === 'name'
  ) {
    return requireTextVar(variable, opts);
  }

  if (variable === 'language') {
    if (!opts.language) {
      throw new MissingTemplateVarError(variable);
    }

    return opts.language;
  }

  throw new MissingTemplateVarError(variable);
}

function resolveNumberVar(
  variable: string,
  width: number,
  opts: ResolveFilenameOpts,
): string {
  const value = variable === 'number' ? opts.number : variable === 'version' ? opts.version : undefined;

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new MissingTemplateVarError(variable);
  }

  return String(value).padStart(width, '0');
}

function originalExtension(originalFilename?: string): string {
  if (!originalFilename?.trim()) {
    throw new OriginalFilenameRequiredError();
  }

  const normalized = originalFilename.normalize('NFKC').replace(/\u3000/g, ' ');
  const basename = normalized.split(/[\\/]/).pop() ?? normalized;
  const dotIndex = basename.lastIndexOf('.');

  return dotIndex > 0 ? basename.slice(dotIndex).toLowerCase() : '';
}

export function resolveFilename(opts: ResolveFilenameOpts): string {
  const rendered = opts.template.replace(
    TEMPLATE_VAR_PATTERN,
    (_placeholder, variable: string, widthRaw: string | undefined) => {
      if (widthRaw !== undefined) {
        return resolveNumberVar(variable, Number(widthRaw), opts);
      }

      return resolveTextVar(variable, opts);
    },
  );
  const base = collapseAndTrimUnderscores(rendered);
  const extension =
    opts.storageExt === 'keep_as_is' ? originalExtension(opts.originalFilename) : opts.storageExt;

  return `${base}${extension}`;
}
