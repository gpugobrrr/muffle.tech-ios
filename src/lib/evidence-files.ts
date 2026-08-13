import {
  createExpoLocalMediaStore,
  mediaFileName,
  mediaRecordDirectory,
  mediaRelativePath,
  type LocalMediaPathConfig,
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
    temporaryUri: string,
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
    copyPhotoToEvidenceDirectory(jobId, evidenceId, temporaryUri) {
      return store.copyFileIntoDirectory(jobId, evidenceId, temporaryUri);
    },
    deleteEvidenceFile(uri) {
      return store.deleteFile(uri);
    },
  };
}

/**
 * Expo SDK 54+ filesystem store using the new File/Directory/Paths API.
 * Survey association rules stay in evidence-capture / Engine operations.
 */
export function createExpoEvidenceFileStore(): EvidenceFileStore {
  return asEvidenceFileStore(createExpoLocalMediaStore(SURVEY_EVIDENCE_MEDIA_PATH));
}
