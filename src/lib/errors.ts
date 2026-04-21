export type ErrorContext = Readonly<Record<string, unknown>>;

/**
 * Base error class for the application. All module-specific errors extend this
 * so that logging, retry, and HTTP-mapping layers can rely on a stable shape:
 * `code` (stable string identifier) + `context` (structured payload).
 */
export abstract class AppError extends Error {
  public abstract readonly code: string;
  public readonly context: ErrorContext;

  constructor(message: string, context: ErrorContext = {}, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.context = context;
  }
}
