import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtUser {
  id: number;
  username: string;
  name: string;
  roleId?: number | null;
}

export const CurrentUser = createParamDecorator(
  (data: keyof JwtUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: JwtUser }>();
    const user = request.user;
    return data && user ? user[data] : user;
  }
);
