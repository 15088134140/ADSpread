import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 12);

  const role = await prisma.role.upsert({
    where: { name: '超级管理员' },
    update: { status: 1 },
    create: {
      name: '超级管理员',
      remark: 'MVP 默认管理员角色',
      status: 1,
      menuIds: [],
    },
  });

  await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {
      passwordHash,
      name: '系统管理员',
      roleId: role.id,
      status: 1,
    },
    create: {
      username: 'admin',
      passwordHash,
      name: '系统管理员',
      roleId: role.id,
      status: 1,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
