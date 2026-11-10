import { HttpException } from '@nestjs/common';

/** Error with a stable machine-readable code, returned as { error: { code, message, details } }. */
export class AppError extends HttpException {
  constructor(
    status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }
}
