import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const { method, originalUrl, ip, errored } = request;
    const userAgent = request.get('user-agent') || '';
    const startTime = Date.now(); 

    response.on('finish', () => {
      const { statusCode } = response;
      const duration = Date.now() - startTime; 

      const logMessage = `${method} ${originalUrl} ${statusCode} - ${duration}ms - ${ip} [${userAgent}]`;

      if (statusCode >= 400) {
        this.logger.error(`${logMessage} - error ${errored}`);
      } else {
        this.logger.log(logMessage);
      }
    });

    next();
  }
}