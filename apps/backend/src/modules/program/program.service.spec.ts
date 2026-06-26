import { ProgramService } from './program.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProgramDto } from './dto/create-program.dto';

describe('ProgramService', () => {
  const prisma = {
    program: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    material: { findMany: jest.fn() },
  } as unknown as PrismaService;

  let service: ProgramService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProgramService(prisma);
  });

  it('creates program with valid data', async () => {
    const createDto: CreateProgramDto = {
      name: 'Test Program',
      screenOrientation: 'LANDSCAPE',
      splitType: 'SPLIT_1',
      regions: [
        {
          regionId: 'region1',
          materials: [{ materialId: 1, duration: 10 }],
        },
      ],
    };

    (prisma.material.findMany as jest.Mock).mockResolvedValue([{ id: 1, auditStatus: 'APPROVED' }]);
    (prisma.program.create as jest.Mock).mockResolvedValue({
      id: 1,
      ...createDto,
      status: 0,
    });

    const result = await service.create(createDto, 1);

    expect(prisma.program.create).toHaveBeenCalled();
    expect(result.name).toBe(createDto.name);
    expect(result.status).toBe(0);
  });

  it('returns paginated programs with metadata', async () => {
    (prisma.program.findMany as jest.Mock).mockResolvedValue([
      {
        id: 1,
        name: 'Program 1',
        screenOrientation: 'LANDSCAPE',
        splitType: 'SPLIT_1',
        status: 0,
      },
      {
        id: 2,
        name: 'Program 2',
        screenOrientation: 'PORTRAIT',
        splitType: 'SPLIT_2',
        status: 1,
      },
    ]);

    (prisma.program.count as jest.Mock).mockResolvedValue(2);

    const result = await service.findAll({ page: 1, pageSize: 10 });

    expect(result.list.length).toBe(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });

  it('publishes program with valid regions', async () => {
    const programId = 1;
    const updateDto = {
      regions: [
        {
          regionId: 'region1',
          materials: [{ materialId: 1, duration: 10 }],
        },
      ],
    };

    (prisma.program.findUnique as jest.Mock).mockResolvedValue({
      id: programId,
      name: 'Test Program',
      screenOrientation: 'LANDSCAPE',
      splitType: 'SPLIT_1',
      status: 0,
    });

    (prisma.material.findMany as jest.Mock).mockResolvedValue([{ id: 1, auditStatus: 'APPROVED' }]);

    (prisma.program.update as jest.Mock).mockResolvedValue({
      id: programId,
      status: 1,
    });

    const result = await service.publish(programId, updateDto);

    expect(result.status).toBe(1);
  });
});
