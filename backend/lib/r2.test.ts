import { beforeEach, describe, expect, it, vi } from 'vitest';

const s3Mocks = vi.hoisted(() => ({
  send: vi.fn(),
}));
const presignerMock = vi.hoisted(() => ({
  getSignedUrl: vi.fn(),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = s3Mocks.send;
  },
  PutObjectCommand: class {
    constructor(public input: unknown) {}
  },
  GetObjectCommand: class {
    constructor(public input: unknown) {}
  },
  HeadObjectCommand: class {
    constructor(public input: unknown) {}
  },
  DeleteObjectCommand: class {
    constructor(public input: unknown) {}
  },
}));
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: presignerMock.getSignedUrl,
}));

import { deleteObject, getPresignedDownloadUrl, headObject, putObject } from './r2';

describe('putObject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends PutObjectCommand with bucket + key + body', async () => {
    s3Mocks.send.mockResolvedValueOnce({ ETag: '"abc123"', VersionId: 'v1' });

    const result = await putObject({
      key: 'a/b.png',
      body: new Uint8Array([1, 2, 3]),
      contentType: 'image/png',
    });

    expect(result).toEqual({ etag: 'abc123', version_id: 'v1' });
    expect(s3Mocks.send).toHaveBeenCalledTimes(1);
    const command = s3Mocks.send.mock.calls[0]?.[0];
    expect(command.input).toMatchObject({
      Bucket: 'fableglitch-assets-test',
      Key: 'a/b.png',
      ContentType: 'image/png',
    });
  });
});

describe('getPresignedDownloadUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns signed URL with given TTL', async () => {
    presignerMock.getSignedUrl.mockResolvedValueOnce('https://r2.example/signed?...');

    const url = await getPresignedDownloadUrl({ key: 'x.png', ttlSec: 900 });

    expect(url).toBe('https://r2.example/signed?...');
    expect(presignerMock.getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ input: expect.objectContaining({ Key: 'x.png' }) }),
      { expiresIn: 900 },
    );
  });
});

describe('headObject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns size and etag when present', async () => {
    s3Mocks.send.mockResolvedValueOnce({ ContentLength: 1234, ETag: '"e"' });

    expect(await headObject('k')).toEqual({ size_bytes: 1234, etag: 'e' });
  });

  it('returns null on NotFound', async () => {
    s3Mocks.send.mockRejectedValueOnce(
      Object.assign(new Error('NotFound'), {
        name: 'NotFound',
        $metadata: { httpStatusCode: 404 },
      }),
    );

    expect(await headObject('missing')).toBeNull();
  });
});

describe('deleteObject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends DeleteObjectCommand', async () => {
    s3Mocks.send.mockResolvedValueOnce({});

    await deleteObject('k');

    expect(s3Mocks.send).toHaveBeenCalled();
  });
});
