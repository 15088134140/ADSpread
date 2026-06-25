import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MaterialService } from './material.service';
import { MaterialQueryDto } from './dto/material-query.dto';
import { ApproveMaterialDto, RejectMaterialDto } from './dto/audit-material.dto';

@ApiTags('素材管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('materials')
export class MaterialController {
  constructor(private readonly materialService: MaterialService) {}

  @Get()
  @ApiOperation({ summary: '分页查询素材列表', description: '支持按关键词、类型、审核状态筛选' })
  @ApiOkResponse({ description: '返回分页素材列表' })
  findAll(@Query() query: MaterialQueryDto) {
    return this.materialService.findAll(query);
  }

  @Get('available')
  @ApiOperation({ summary: '获取可用素材', description: '返回所有审核通过的素材，供节目制作选择' })
  @ApiOkResponse({ description: '审核通过的素材列表' })
  available() {
    return this.materialService.available();
  }

  @Post('upload')
  @ApiOperation({ summary: '上传素材', description: '上传图片或视频素材，上传后状态为待审核' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: '素材文件（图片/视频）' },
      },
      required: ['file'],
    },
  })
  @ApiOkResponse({ description: '上传成功，返回素材信息' })
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File, @CurrentUser('id') adminId: number) {
    return this.materialService.upload(file, adminId);
  }

  @Put(':id/approve')
  @ApiOperation({ summary: '审核通过', description: '通过指定素材的审核，清空原驳回原因' })
  @ApiOkResponse({ description: '审核通过，返回更新后的素材信息' })
  approve(
    @Param('id') id: number,
    @CurrentUser('id') adminId: number,
    @Body() dto?: ApproveMaterialDto
  ) {
    return this.materialService.approve(Number(id), adminId, dto);
  }

  @Put(':id/reject')
  @ApiOperation({ summary: '审核驳回', description: '驳回指定素材，需提供至少10个字符的驳回原因' })
  @ApiOkResponse({ description: '审核驳回，返回更新后的素材信息' })
  reject(
    @Param('id') id: number,
    @CurrentUser('id') adminId: number,
    @Body() dto: RejectMaterialDto
  ) {
    return this.materialService.reject(Number(id), adminId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除素材', description: '素材被节目引用时禁止删除' })
  @ApiOkResponse({ description: '删除成功' })
  remove(@Param('id') id: number) {
    return this.materialService.remove(Number(id));
  }
}
