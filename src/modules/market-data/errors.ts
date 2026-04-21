import { AppError } from '../../lib/errors';

export class MarketDataError extends AppError {
  public override readonly code = 'MARKET_DATA_ERROR';
}
