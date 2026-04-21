import { AppError } from '../../lib/errors';

export class ProductDataError extends AppError {
  public override readonly code = 'PRODUCT_DATA_ERROR';
}
