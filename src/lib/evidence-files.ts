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
      if (!source.exists) {
        throw new Error('Captured photo file is missing');
      }

      const destination = new File(directory, evidencePhotoFilename(evidenceId));
      if (destination.exists) {
        destination.delete();
      }

      source.copy(destination);
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
