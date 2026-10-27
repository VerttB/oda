import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'super-secret-key-change-in-env'),
    });
  }

  async validate(payload: any) {
    if (payload.role !== 'ADMIN') {
      throw new UnauthorizedException('O token nao possui permissao administrativa.');
    }
    return { userId: payload.sub, username: payload.username, role: payload.role };
  }
}
