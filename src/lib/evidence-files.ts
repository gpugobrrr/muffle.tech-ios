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

export function createExpoEvidenceFileStore(): EvidenceFileStore {
  // Lazy import keeps Node unit tests free of native module resolution.
  return createExpoEvidenceFileStoreSync();
}

function createExpoEvidenceFileStoreSync(): EvidenceFileStore {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const FileSystem = require('expo-file-system') as typeof import('expo-file-system');

  return {
    async ensureJobEvidenceDirectory(jobId: string): Promise<string> {
      const directory = `${FileSystem.documentDirectory}${evidenceJobDirectory(jobId)}/`;
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      return directory;
    },
    async copyPhotoToEvidenceDirectory(
      jobId: string,
      evidenceId: string,
      temporaryUri: string,
    ): Promise<string> {
      const directory = await this.ensureJobEvidenceDirectory(jobId);
      const destination = `${directory}/${evidencePhotoFilename(evidenceId)}`;
      await FileSystem.copyAsync({ from: temporaryUri, to: destination });
      return destination;
    },
    async deleteEvidenceFile(uri: string): Promise<void> {
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch {
        // Best-effort cleanup when canonical commit fails after copy.
      }
    },
  };
}
