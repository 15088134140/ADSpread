import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtUser } from '../../common/decorators/current-user.decorator';

interface JwtPayload {
  sub: number;
  username: string;
  name: string;
  roleId?: number | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'adspread-dev-secret',
    });
  }

  validate(payload: JwtPayload): JwtUser {
    return {
      id: payload.sub,
      username: payload.username,
      name: payload.name,
      roleId: payload.roleId,
    };
  }
}
