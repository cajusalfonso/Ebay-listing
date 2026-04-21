import { AppError } from '../../lib/errors';

export class ImageError extends AppError {
  public override readonly code = 'IMAGE_ERROR';
}
