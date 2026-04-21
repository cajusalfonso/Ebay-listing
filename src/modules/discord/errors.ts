import { AppError } from '../../lib/errors';

export class DiscordError extends AppError {
  public override readonly code = 'DISCORD_ERROR';
}
