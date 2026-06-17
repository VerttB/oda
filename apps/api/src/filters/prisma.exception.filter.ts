import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@oda/database';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    console.error('Prisma Error Code:', exception.code);
    console.error('Prisma Error Message:', exception.message);
    const httpException = this.toHttpException(exception);
    const context = host.switchToHttp();
    const response = context.getResponse();
    const request = context.getRequest();
    const statusCode = httpException.getStatus();

    response.status(statusCode).json({
      statusCode,
      message: httpException.message,
      error: httpException.name,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private toHttpException(
    exception: Prisma.PrismaClientKnownRequestError,
  ): HttpException {
    switch (exception.code) {
      case 'P2025':
        return new NotFoundException('Registro nao encontrado');

      case 'P2002':
        return new ConflictException('Registro duplicado');

      case 'P2003':
        return new UnprocessableEntityException(
          'Referencia invalida para outro registro',
        );
    
      case 'P2014':
        return new UnprocessableEntityException(
          'Operacao viola uma relacao obrigatoria',
        );

      default:
        return new InternalServerErrorException('Erro ao acessar o banco');
    }
  }
}
