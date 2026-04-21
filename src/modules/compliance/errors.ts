import { AppError } from '../../lib/errors';

/**
 * Thrown for configuration-level compliance errors (e.g. malformed keyword-blacklist
 * regex pattern). Not used for the normal "this product fails a check" signal — that
 * is surfaced non-throwing via ComplianceResult.blockers so callers can display every
 * problem at once.
 */
export class ComplianceError extends AppError {
  public override readonly code = 'COMPLIANCE_ERROR';
}
