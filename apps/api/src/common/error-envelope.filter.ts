import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { AppError } from './app-error.js';

@Catch()
export class ErrorEnvelopeFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = 500;
    let code = 'internal_error';
    let message = 'Something went wrong on our side. Please try again.';
    let details: unknown;

    if (exception instanceof AppError) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse() as string | { message?: string | string[] };
      if (status === 400 && typeof body === 'object' && Array.isArray(body.message)) {
        code = 'validation_failed';
        message = 'Some fields are not valid';
        details = body.message;
      } else {
        code =
          status === 401 ? 'unauthorized' : status === 403 ? 'forbidden' : status === 404 ? 'not_found' : 'http_error';
        message = typeof body === 'string' ? body : ((body.message as string | undefined) ?? exception.message);
      }
    } else {
      this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    }

    res.status(status).json({ error: { code, message, details } });
  }
}
