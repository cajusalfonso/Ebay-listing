import { AppError } from '../../lib/errors';

/**
 * Thrown for any pricing-engine error: invalid inputs, arithmetic impossibilities,
 * unsatisfiable constraints. The `context.reason` field narrows the cause.
 */
export class PricingError extends AppError {
  public override readonly code = 'PRICING_ERROR';
}
