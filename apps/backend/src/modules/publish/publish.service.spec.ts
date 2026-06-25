import { PublishService } from './publish.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePublishPlanDto } from './dto/create-publish-plan.dto';

describe('PublishService', () => {
  const prisma = {
    publishPlan: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    program: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
    store: { findMany: jest.fn(), count: jest.fn() },
    device: { findMany: jest.fn(), count: jest.fn() },
    pushMessageLog: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  } as unknown as PrismaService;

  let service: PublishService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PublishService(prisma);
  });

  it('creates publish plan with valid data', async () => {
    const createDto: CreatePublishPlanDto = {
      name: 'Test Publish Plan',
      programId: 1,
      targetStoreIds: [1, 2],
      startTime: '2024-01-01 00:00:00',
      endTime: '2024-01-31 23:59:59',
      playDays: [1, 2, 3, 4, 5],
      status: 1,
    };

    (prisma.program.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      name: 'Test Program',
      status: 1,
    });
    (prisma.store.count as jest.Mock).mockResolvedValue(2);
    (prisma.publishPlan.create as jest.Mock).mockResolvedValue({
      id: 1,
      ...createDto,
    });

    const result = await service.create(createDto, 1);

    expect(prisma.publishPlan.create).toHaveBeenCalled();
    expect(result.name).toBe(createDto.name);
    expect(result.status).toBe(1);
  });

  it('returns paginated publish plans with metadata', async () => {
    (prisma.publishPlan.findMany as jest.Mock).mockResolvedValue([
      {
        id: 1,
        name: 'Plan 1',
        programId: 1,
        status: 1,
      },
      {
        id: 2,
        name: 'Plan 2',
        programId: 2,
        status: 0,
      },
    ]);

    (prisma.publishPlan.count as jest.Mock).mockResolvedValue(2);

    const result = await service.findAll({ page: 1, pageSize: 10 });

    expect(result.list.length).toBe(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });

  it('publishes program and creates push log', async () => {
    const planId = 1;

    (prisma.publishPlan.findUnique as jest.Mock).mockResolvedValue({
      id: planId,
      name: 'Test Plan',
      programId: 1,
      targetStoreIds: [1, 2],
      status: 1,
      program: {
        id: 1,
        layoutConfig: {
          regions: [
            {
              regionId: 'region1',
              materials: [{ materialId: 1, duration: 10 }],
            },
          ],
        },
      },
    });

    (prisma.device.count as jest.Mock).mockResolvedValue(5);
    (prisma.publishPlan.update as jest.Mock).mockResolvedValue({ id: planId });
    (prisma.pushMessageLog.create as jest.Mock).mockResolvedValue({ id: 1 });

    const result = await service.push(planId, 1);

    expect(prisma.device.count).toHaveBeenCalled();
    expect(prisma.publishPlan.update).toHaveBeenCalled();
    expect(prisma.pushMessageLog.create).toHaveBeenCalled();
  });
});
