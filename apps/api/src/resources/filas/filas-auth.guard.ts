import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Diferente do guard geral, as leituras administrativas tambem exigem JWT.
@Injectable()
export class FilasJwtAuthGuard extends AuthGuard('jwt') {}
