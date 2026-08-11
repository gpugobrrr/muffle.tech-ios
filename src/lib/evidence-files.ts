export type EvidenceFileStore = {
  ensureJobEvidenceDirectory(jobId: string): Promise<string>;
  copyPhotoToEvidenceDirectory(
    jobId: string,
    evidenceId: string,
    temporaryUri: string,
  ): Promise<string>;
  deleteEvidenceFile(uri: string): Promise<void>;
};

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function evidencePhotoFilename(evidenceId: string): string {
  return `${sanitizeSegment(evidenceId)}.jpg`;
}

export function evidenceJobDirectory(jobId: string): string {
  const safeJobId = sanitizeSegment(jobId);
  return `muffle/jobs/${safeJobId}/evidence`;
}

export function evidencePhotoRelativePath(jobId: string, evidenceId: string): string {
  return `${evidenceJobDirectory(jobId)}/${evidencePhotoFilename(evidenceId)}`;
}

/**
 * Expo SDK 54+ filesystem store using the new File/Directory/Paths API.
 * Do not call deprecated filesystem helpers from the main expo-file-system
 * entry — they warn and throw at runtime. Use File/Directory/Paths instead.
 *
 * Prefer bytes()+write() over File.copy(): on Android, copy() goes through
 * java.io.File and cannot read content:// (and some FileProvider) URIs that
 * ImagePicker may still surface. bytes()/write() use stream APIs that can.
 */
export function createExpoEvidenceFileStore(): EvidenceFileStore {
  // Lazy import keeps Node unit tests free of native module resolution.
  return createExpoEvidenceFileStoreSync();
}

function createExpoEvidenceFileStoreSync(): EvidenceFileStore {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Directory, File, Paths } = require('expo-file-system') as typeof import('expo-file-system');

  function jobEvidenceDirectory(jobId: string): InstanceType<typeof Directory> {
    const safeJobId = sanitizeSegment(jobId);
    return new Directory(Paths.document, 'muffle', 'jobs', safeJobId, 'evidence');
  }

  async function writePhotoBytes(
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

  function copyPhotoFile(
    source: InstanceType<typeof File>,
    destination: InstanceType<typeof File>,
  ): void {
    if (destination.exists) {
      destination.delete();
    }
    source.copy(destination);
  }

  return {
    async ensureJobEvidenceDirectory(jobId: string): Promise<string> {
      const directory = jobEvidenceDirectory(jobId);
      directory.create({ intermediates: true, idempotent: true });
      return directory.uri;
    },

    async copyPhotoToEvidenceDirectory(
      jobId: string,
      evidenceId: string,
      temporaryUri: string,
    ): Promise<string> {
      const directory = jobEvidenceDirectory(jobId);
      directory.create({ intermediates: true, idempotent: true });

      const source = new File(temporaryUri);
      const destination = new File(directory, evidencePhotoFilename(evidenceId));

      try {
        await writePhotoBytes(source, destination);
      } catch (bytesError) {
        console.warn(
          '[evidence-photo] bytes()/write() failed; falling back to File.copy()',
          {
            temporaryUri,
            sourceExists: source.exists,
            bytesError,
          },
        );
        try {
          copyPhotoFile(source, destination);
        } catch (copyError) {
          console.error('[evidence-photo] File.copy() also failed', {
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
        throw new Error('Photo copy did not produce a destination file');
      }

      return destination.uri;
    },

    async deleteEvidenceFile(uri: string): Promise<void> {
      try {
        const file = new File(uri);
        if (file.exists) {
          file.delete();
        }
      } catch {
        // Best-effort cleanup when canonical commit fails after copy.
      }
    },
  };
}
