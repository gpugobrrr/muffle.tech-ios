/**
 * Domain-neutral local media file storage.
 *
 * Stores files by record ID. Callers decide what a record is (job, listing,
 * inventory). This module does not associate files with domain records.
 *
 * Canonical callers still persist only a URI string on domain records.
 * Image bytes never belong in serialized application state.
 *
 * Native: copy into application document storage (durable across restarts).
 * Web: same-session blob object URLs. This runtime has no IndexedDB/media
 * blob store, so Web URIs do not survive a browser restart or full reload.
 */

export type LocalMediaSource = {
  /** Picker or filesystem URI. On Web this is often a `blob:` URL. */
  uri: string;
  /**
   * Browser `File`/`Blob` from Expo ImagePicker on Web.
   * Never copy this through native `expo-file-system` File APIs.
   * Never serialize this onto domain records.
   */
  file?: Blob;
};

export type LocalMediaStore = {
  ensureRecordDirectory(recordId: string): Promise<string>;
  copyFileIntoDirectory(
    recordId: string,
    fileId: string,
    source: string | LocalMediaSource,
  ): Promise<string>;
  deleteFile(uri: string): Promise<void>;
};

export type LocalMediaPathConfig = {
  /** Path segments under the document directory, e.g. `['muffle', 'jobs']`. */
  rootSegments: readonly string[];
  /** Leaf folder for files of one record, e.g. `'evidence'`. */
  leafDirectory: string;
  /** File extension without a leading dot. */
  extension: string;
};

export const WEB_SESSION_MEDIA_LIMITATION =
  'Web photo URIs are session blob object URLs. They render until the tab is closed or reloaded, but they are not restart-durable because this app has no browser media blob store.';

export function sanitizeMediaSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function mediaFileName(fileId: string, extension: string): string {
  return `${sanitizeMediaSegment(fileId)}.${extension.replace(/^\./, '')}`;
}

export function mediaRecordDirectory(
  config: LocalMediaPathConfig,
  recordId: string,
): string {
  const safeRecordId = sanitizeMediaSegment(recordId);
  return [...config.rootSegments, safeRecordId, config.leafDirectory].join('/');
}

export function mediaRelativePath(
  config: LocalMediaPathConfig,
  recordId: string,
  fileId: string,
): string {
  return `${mediaRecordDirectory(config, recordId)}/${mediaFileName(fileId, config.extension)}`;
}

export function normalizeLocalMediaSource(
  source: string | LocalMediaSource,
): LocalMediaSource {
  return typeof source === 'string' ? { uri: source } : source;
}

export function isBrowserSessionMediaRuntime(): boolean {
  return typeof globalThis.document !== 'undefined';
}

export function isBrowserSessionMediaUri(uri: string): boolean {
  return uri.startsWith('blob:');
}

export function containsEmbeddedImageBytes(value: string): boolean {
  return /data:image\//i.test(value) || /["']base64["']/.test(value);
}

export function isBlobLike(value: unknown): value is Blob {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Blob).arrayBuffer === 'function' &&
    typeof (value as Blob).size === 'number'
  );
}

/**
 * Accept a Web ImagePicker asset (`uri` plus optional browser `File`) or a
 * native `file://` URI. Reject data-URL payloads so bytes never become the
 * canonical stored URI.
 */
export function localMediaSourceFromPickerAsset(asset: {
  uri?: string | null;
  file?: unknown;
}): LocalMediaSource | null {
  const uri = typeof asset.uri === 'string' ? asset.uri.trim() : '';
  const file = isBlobLike(asset.file) ? asset.file : undefined;
  if (uri.startsWith('data:')) {
    return null;
  }
  if (file) {
    return { uri, file };
  }
  if (uri) {
    return { uri };
  }
  return null;
}

/**
 * Native filesystem copy may only receive a real file URI.
 * Browser File/blob/data sources must be handled by the Web session store.
 */
export function nativeFilesystemCopyUri(
  source: string | LocalMediaSource,
): string {
  const media = normalizeLocalMediaSource(source);
  if (media.file) {
    throw new Error(
      'Native filesystem copy cannot receive a browser File/blob',
    );
  }
  const uri = media.uri.trim();
  if (!uri) {
    throw new Error('Native filesystem copy requires a file URI');
  }
  if (isBrowserSessionMediaUri(uri) || uri.startsWith('data:')) {
    throw new Error(
      'Native filesystem copy cannot receive a browser blob or data URI',
    );
  }
  return uri;
}

function createObjectUrl(file: Blob): string {
  const create = globalThis.URL?.createObjectURL;
  if (typeof create !== 'function') {
    throw new Error('Web session media requires URL.createObjectURL');
  }
  return create.call(globalThis.URL, file);
}

function revokeObjectUrl(uri: string): void {
  const revoke = globalThis.URL?.revokeObjectURL;
  if (typeof revoke === 'function' && isBrowserSessionMediaUri(uri)) {
    try {
      revoke.call(globalThis.URL, uri);
    } catch {
      // Best-effort; some test environments stub revoke.
    }
  }
}

/**
 * Same-session Web media persistence.
 *
 * Produces a renderable object URL from a browser File/blob. Does not write
 * through expo-file-system. Does not survive browser restart.
 */
export function createWebSessionLocalMediaStore(): LocalMediaStore {
  const createdObjectUrls = new Set<string>();

  return {
    async ensureRecordDirectory(recordId: string): Promise<string> {
      return `web-session://${sanitizeMediaSegment(recordId)}`;
    },

    async copyFileIntoDirectory(
      _recordId: string,
      _fileId: string,
      source: string | LocalMediaSource,
    ): Promise<string> {
      const media = normalizeLocalMediaSource(source);
      if (media.uri.startsWith('data:')) {
        throw new Error('Web session media cannot persist data: URIs');
      }
      if (media.file) {
        const uri = createObjectUrl(media.file);
        createdObjectUrls.add(uri);
        return uri;
      }
      if (isBrowserSessionMediaUri(media.uri)) {
        return media.uri;
      }
      throw new Error(
        'Web session media requires a File/blob or blob: URI',
      );
    },

    async deleteFile(uri: string): Promise<void> {
      if (createdObjectUrls.has(uri)) {
        createdObjectUrls.delete(uri);
      }
      revokeObjectUrl(uri);
    },
  };
}

export function createPlatformLocalMediaStore(
  config: LocalMediaPathConfig,
): LocalMediaStore {
  if (isBrowserSessionMediaRuntime()) {
    return createWebSessionLocalMediaStore();
  }
  return createExpoLocalMediaStore(config);
}

/**
 * Expo SDK 54+ filesystem store using File/Directory/Paths.
 * Lazy-loaded so Node unit tests that only use path helpers stay native-free.
 */
export function createExpoLocalMediaStore(
  config: LocalMediaPathConfig,
): LocalMediaStore {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Directory, File, Paths } = require('expo-file-system') as typeof import('expo-file-system');

  function recordDirectory(recordId: string): InstanceType<typeof Directory> {
    const safeRecordId = sanitizeMediaSegment(recordId);
    return new Directory(
      Paths.document,
      ...config.rootSegments,
      safeRecordId,
      config.leafDirectory,
    );
  }

  async function writeFileBytes(
    source: InstanceType<typeof File>,
    destination: InstanceType<typeof File>,
  ): Promise<void> {
    const bytes = await source.bytes();
    if (destination.exists) {
      destination.delete();
    }
    destination.create();
    destination.write(bytes);
  }

  function copyFile(
    source: InstanceType<typeof File>,
    destination: InstanceType<typeof File>,
  ): void {
    if (destination.exists) {
      destination.delete();
    }
    source.copy(destination);
  }

  return {
    async ensureRecordDirectory(recordId: string): Promise<string> {
      const directory = recordDirectory(recordId);
      directory.create({ intermediates: true, idempotent: true });
      return directory.uri;
    },

    async copyFileIntoDirectory(
      recordId: string,
      fileId: string,
      source: string | LocalMediaSource,
    ): Promise<string> {
      const temporaryUri = nativeFilesystemCopyUri(source);
      const directory = recordDirectory(recordId);
      directory.create({ intermediates: true, idempotent: true });

      const sourceFile = new File(temporaryUri);
      const destination = new File(
        directory,
        mediaFileName(fileId, config.extension),
      );

      try {
        await writeFileBytes(sourceFile, destination);
      } catch (bytesError) {
        console.warn(
          '[local-media] bytes()/write() failed; falling back to File.copy()',
          {
            temporaryUri,
            sourceExists: sourceFile.exists,
            bytesError,
          },
        );
        try {
          copyFile(sourceFile, destination);
        } catch (copyError) {
          console.error('[local-media] File.copy() also failed', {
            temporaryUri,
            sourceExists: sourceFile.exists,
            destinationUri: destination.uri,
            bytesError,
            copyError,
          });
          throw copyError;
        }
      }

      if (!destination.exists) {
        throw new Error('File copy did not produce a destination file');
      }

      return destination.uri;
    },

    async deleteFile(uri: string): Promise<void> {
      try {
        const file = new File(uri);
        if (file.exists) {
          file.delete();
        }
      } catch {
        // Best-effort cleanup when a later canonical commit fails.
      }
    },
  };
}
