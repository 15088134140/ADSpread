import { Injectable } from '@nestjs/common';
import { Prisma, Material, AuditStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../../common/errors/business.exception';
import { getPagination, paginated } from '../../common/utils/pagination';
import { assertMaterialFile } from '../../common/utils/file';
import { MaterialQueryDto } from './dto/material-query.dto';
import { ApproveMaterialDto, RejectMaterialDto } from './dto/audit-material.dto';

@Injectable()
export class MaterialService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: MaterialQueryDto) {
    const { page, pageSize, skip, take } = getPagination(query);
    const where: Prisma.MaterialWhereInput = {};

    if (query.keyword) {
      where.OR = [
        { name: { contains: query.keyword } },
        { fileExtension: { contains: query.keyword } },
      ];
    }
    if (query.type) where.type = query.type;
    if (query.auditStatus) where.auditStatus = query.auditStatus;

    const [list, total] = await Promise.all([
      this.prisma.material.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { creator: true, auditor: true },
      }),
      this.prisma.material.count({ where }),
    ]);

    return paginated(
      list.map((m) => this.serializeMaterial(m)),
      total,
      page,
      pageSize
    );
  }

  async available() {
    const materials = await this.prisma.material.findMany({
      where: { auditStatus: AuditStatus.APPROVED },
      orderBy: { createdAt: 'desc' },
    });

    return materials.map((m) => this.serializeMaterial(m));
  }

  async upload(file: Express.Multer.File, adminId: number) {
    const materialType = assertMaterialFile(file);
    const originalName = this.decodeFilename(file.originalname);
    const extension = this.getFileExtension(originalName);
    const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${extension}`;
    const filePath = this.getUploadPath(filename);

    await this.saveFile(file, filePath);

    const material = await this.prisma.material.create({
      data: {
        name: originalName,
        type: materialType,
        fileUrl: `/uploads/materials/${filename}`,
        fileSize: BigInt(file.size),
        fileExtension: extension,
        auditStatus: AuditStatus.PENDING,
        createdBy: adminId,
      },
    });

    return this.serializeMaterial(material);
  }

  /**
   * Multer 默认以 Latin-1 解析 Content-Disposition 中的文件名，
   * 导致中文乱码。这里把 Latin-1 字节串重新按 UTF-8 解码还原。
   */
  private decodeFilename(originalname: string): string {
    try {
      return Buffer.from(originalname, 'latin1').toString('utf8');
    } catch {
      return originalname;
    }
  }

  async approve(id: number, adminId: number, _dto?: ApproveMaterialDto) {
    const material = await this.assertExists(id);
    if (material.auditStatus === AuditStatus.APPROVED) return this.serializeMaterial(material);

    const updated = await this.prisma.material.update({
      where: { id },
      data: {
        auditStatus: AuditStatus.APPROVED,
        auditUserId: adminId,
        auditTime: new Date(),
        auditReason: null,
      },
    });
    return this.serializeMaterial(updated);
  }

  async reject(id: number, adminId: number, dto: RejectMaterialDto) {
    const material = await this.assertExists(id);
    if (material.auditStatus === AuditStatus.REJECTED) return this.serializeMaterial(material);

    if (dto.reason.length < 10) {
      throw new BusinessException('驳回原因至少10个字符');
    }

    const updated = await this.prisma.material.update({
      where: { id },
      data: {
        auditStatus: AuditStatus.REJECTED,
        auditUserId: adminId,
        auditTime: new Date(),
        auditReason: dto.reason,
      },
    });
    return this.serializeMaterial(updated);
  }

  async remove(id: number) {
    await this.assertExists(id);

    // 由于 Prisma JSON 路径查询的限制，我们需要先查询所有包含素材引用的节目
    const allPrograms = await this.prisma.program.findMany({
      select: { id: true, layoutConfig: true },
    });

    const programCount = allPrograms.filter((program) => {
      const layout = program.layoutConfig as any;
      if (!layout || !layout.regions) return false;

      return layout.regions.some(
        (region: any) =>
          region.materials && region.materials.some((material: any) => material.materialId === id)
      );
    }).length;

    if (programCount > 0) {
      throw new BusinessException('该素材已被使用在节目中，无法删除');
    }

    const deleted = await this.prisma.material.delete({ where: { id } });
    return this.serializeMaterial(deleted);
  }

  private serializeMaterial(material: Material) {
    return {
      ...material,
      fileSize: Number(material.fileSize),
    };
  }

  private getFileExtension(filename: string): string {
    const lastIndex = filename.lastIndexOf('.');
    return lastIndex > 0 ? filename.slice(lastIndex + 1).toLowerCase() : '';
  }

  private getUploadPath(filename: string): string {
    const dir = path.join(process.cwd(), 'uploads', 'materials');

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    return path.join(dir, filename);
  }

  private saveFile(file: Express.Multer.File, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, file.buffer, (err: NodeJS.ErrnoException | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async assertExists(id: number): Promise<Material> {
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new BusinessException('素材不存在');
    return material;
  }
}
