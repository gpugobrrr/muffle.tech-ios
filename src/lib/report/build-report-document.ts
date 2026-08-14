import { withInspectionBrief } from '@/lib/job-persistence';
import { buildSurveyReport } from '@/lib/report/build-survey-report';
import { projectSurveyReportDocument } from '@/lib/report/project-survey-report-document';
import { ReportBuildError } from '@/lib/report/report-build-error';
import type { ReportDocument } from '@/types/report';
import type { ActiveJob, InspectionBrief } from '@/types/workspace';

export type ReportBuildInput = {
  activeJob: ActiveJob;
  inspectionBrief: InspectionBrief;
};

export { ReportBuildError };

/**
 * Presentation adapter: ActiveJob → SurveyReportModel → ReportDocument.
 * Draft entry, notes, completion, suggestions, and UI state are not accepted.
 */
export function buildReportDocument({
  activeJob,
  inspectionBrief,
}: ReportBuildInput): ReportDocument {
  const job = withInspectionBrief(activeJob, inspectionBrief);
  return projectSurveyReportDocument(buildSurveyReport(job));
}
