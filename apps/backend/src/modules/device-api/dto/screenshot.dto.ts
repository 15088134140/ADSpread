import { ApiProperty } from '@nestjs/swagger';

/**
 * POST /device/screenshot 响应（spec §1.2 screenshot）。
 *
 * 截图以 multipart 上传（FileInterceptor('file')，与 material 上传一致），
 * 存储到 uploads/screenshots/<deviceId>_<timestamp>.jpg，返回静态资源 URL。
 * url 由 main.ts 的 useStaticAssets('uploads', {prefix:'/uploads/'}) 提供访问。
 */
export class ScreenshotRes {
  @ApiProperty({
    description: '截图访问 URL（静态资源路径）',
    example: '/uploads/screenshots/1_1719360000000.jpg',
  })
  url: string;
}
