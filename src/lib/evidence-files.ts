import {
  createPlatformLocalMediaStore,
  mediaFileName,
  mediaRecordDirectory,
  mediaRelativePath,
  type LocalMediaPathConfig,
  type LocalMediaSource,
  type LocalMediaStore,
} from '@/core/local-media-store';

/** Survey-domain local photo layout under the application document directory. */
export const SURVEY_EVIDENCE_MEDIA_PATH: LocalMediaPathConfig = {
  rootSegments: ['muffle', 'jobs'],
  leafDirectory: 'evidence',
  extension: 'jpg',
};

export type EvidenceFileStore = {
  ensureJobEvidenceDirectory(jobId: string): Promise<string>;
  copyPhotoToEvidenceDirectory(
    jobId: string,
    evidenceId: string,
    source: string | LocalMediaSource,
  ): Promise<string>;
  deleteEvidenceFile(uri: string): Promise<void>;
};

export function evidencePhotoFilename(evidenceId: string): string {
  return mediaFileName(evidenceId, SURVEY_EVIDENCE_MEDIA_PATH.extension);
}

export function evidenceJobDirectory(jobId: string): string {
  return mediaRecordDirectory(SURVEY_EVIDENCE_MEDIA_PATH, jobId);
}

export function evidencePhotoRelativePath(jobId: string, evidenceId: string): string {
  return mediaRelativePath(SURVEY_EVIDENCE_MEDIA_PATH, jobId, evidenceId);
}

function asEvidenceFileStore(store: LocalMediaStore): EvidenceFileStore {
  return {
    ensureJobEvidenceDirectory(jobId) {
      return store.ensureRecordDirectory(jobId);
    },
    copyPhotoToEvidenceDirectory(jobId, evidenceId, source) {
      return store.copyFileIntoDirectory(jobId, evidenceId, source);
    },
    deleteEvidenceFile(uri) {
      return store.deleteFile(uri);
    },
  };
}

/**
 * Platform evidence file store.
 * Native uses Expo document-directory copy. Web uses same-session blob URLs.
 * Survey association rules stay in evidence-capture / Engine operations.
 */
export function createExpoEvidenceFileStore(): EvidenceFileStore {
  return asEvidenceFileStore(
    createPlatformLocalMediaStore(SURVEY_EVIDENCE_MEDIA_PATH),
  );
}
