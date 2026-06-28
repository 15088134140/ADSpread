import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * 设备端鉴权后挂载到 request.device 上的设备身份信息。
 * storeId 可能为 null（设备未绑定门店）。
 */
export interface DeviceIdentity {
  id: number;
  code: string;
  storeId: number | null;
}

export const CurrentDevice = createParamDecorator(
  (data: keyof DeviceIdentity | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ device?: DeviceIdentity }>();
    const device = request.device;
    return data && device ? device[data] : device;
  }
);
