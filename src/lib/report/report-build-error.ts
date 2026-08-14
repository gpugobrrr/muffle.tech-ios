export class ReportBuildError extends Error {
  readonly code = 'MISSING_PROPERTY';

  constructor() {
    super('A structured selected property is required to build a report.');
    this.name = 'ReportBuildError';
  }
}
