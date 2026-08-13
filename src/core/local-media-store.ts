/**
 * Domain-neutral local media file storage.
 *
 * Stores files by record ID. Callers decide what a record is (job, listing,
 * inventory). This module does not associate files with domain records.
 */

export type LocalMediaStore = {
  ensureRecordDirectory(recordId: string): Promise<string>;
  copyFileIntoDirectory(
    recordId: string,
    fileId: string,
    temporaryUri: string,
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
      temporaryUri: string,
    ): Promise<string> {
      const directory = recordDirectory(recordId);
      directory.create({ intermediates: true, idempotent: true });

      const source = new File(temporaryUri);
      const destination = new File(
        directory,
        mediaFileName(fileId, config.extension),
      );

      try {
        await writeFileBytes(source, destination);
      } catch (bytesError) {
        console.warn(
          '[local-media] bytes()/write() failed; falling back to File.copy()',
          {
            temporaryUri,
            sourceExists: source.exists,
            bytesError,
          },
        );
        try {
          copyFile(source, destination);
        } catch (copyError) {
          console.error('[local-media] File.copy() also failed', {
            temporaryUri,
            sourceExists: source.exists,
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
