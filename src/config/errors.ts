import { AppError } from '../lib/errors';

/**
 * Thrown when `process.env` fails Zod schema validation.
 * The error message lists each offending key with its Zod issue.
 */
export class EnvValidationError extends AppError {
  public override readonly code = 'ENV_VALIDATION_ERROR';
}

/**
 * Thrown when a JSON config file under `config-files/` is missing or malformed.
 */
export class ConfigError extends AppError {
  public override readonly code = 'CONFIG_ERROR';
}
