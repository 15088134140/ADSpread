# 信发系统管理端与服务端 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the management-admin + backend MVP vertical slice: login, stores, devices, material upload/audit, programs, publish plans, push records, and device program lookup.

**Architecture:** Implement a real NestJS + Prisma backend and Vue3 + Element Plus admin frontend against a single shared API contract. Align code to PRD and technical design first; if PRD and technical design conflict inside MVP scope, update docs before implementation. Keep modules focused by domain and avoid generic CRUD abstractions.

**Tech Stack:** NestJS 10, Prisma 5, MySQL, JWT, bcrypt, Multer, Vue 3, TypeScript, Pinia, Vue Router, Element Plus, Axios, Jest, supertest.

---

## 0. Required context before implementation

Read these files before starting Task 1:

- `docs/superpowers/specs/2026-06-25-adspread-admin-backend-mvp-design.md`
- `docs/requirements/信发系统_产品需求文档.md`
- `docs/architecture/信发系统_技术设计文档.md`
- `.ai/workflow.md`
- `.ai/tool-rules.md`
- `.ai/coding-standards.md`
- `.ai/backend-standards.md`
- `.ai/admin-standards.md`

Important execution rules:

- If using subagents, each implementation subagent must end its prompt with: `⚠️ 重要规则：不要执行 git commit 命令！完成后只需要列出你修改/创建的所有文件路径，提交操作由父代理统一执行。`
- Subagents must not commit. Parent agent performs commits after review and verification.
- Current branch at plan time is `main`; create a feature branch before implementation unless the user explicitly says otherwise.
- User has approved the design spec but has not explicitly requested a git commit yet. Ask before committing if required by current session policy.

---

## 1. File structure map

### Backend files to create

- `apps/backend/src/common/constants/business.constants.ts` — shared backend constants for statuses, split types, industry categories, file constraints.
- `apps/backend/src/common/errors/business-error-codes.ts` — business error code constants.
- `apps/backend/src/common/errors/business.exception.ts` — typed business exception wrapper.
- `apps/backend/src/common/decorators/current-user.decorator.ts` — extract JWT user from request.
- `apps/backend/src/common/guards/jwt-auth.guard.ts` — JWT auth guard.
- `apps/backend/src/common/utils/pagination.ts` — parse pagination and build paginated responses.
- `apps/backend/src/common/utils/layout.ts` — split type → region count and region coordinate helpers.
- `apps/backend/src/common/utils/file.ts` — file extension/MIME/size helpers.
- `apps/backend/src/modules/auth/auth.module.ts`
- `apps/backend/src/modules/auth/auth.controller.ts`
- `apps/backend/src/modules/auth/auth.service.ts`
- `apps/backend/src/modules/auth/jwt.strategy.ts`
- `apps/backend/src/modules/auth/dto/login.dto.ts`
- `apps/backend/src/modules/store/store.module.ts`
- `apps/backend/src/modules/store/store.controller.ts`
- `apps/backend/src/modules/store/store.service.ts`
- `apps/backend/src/modules/store/dto/store-query.dto.ts`
- `apps/backend/src/modules/store/dto/create-store.dto.ts`
- `apps/backend/src/modules/store/dto/update-store.dto.ts`
- `apps/backend/src/modules/device/device.module.ts`
- `apps/backend/src/modules/device/device.controller.ts`
- `apps/backend/src/modules/device/device.service.ts`
- `apps/backend/src/modules/device/dto/device-query.dto.ts`
- `apps/backend/src/modules/device/dto/create-device.dto.ts`
- `apps/backend/src/modules/device/dto/update-device.dto.ts`
- `apps/backend/src/modules/material/material.module.ts`
- `apps/backend/src/modules/material/material.controller.ts`
- `apps/backend/src/modules/material/material.service.ts`
- `apps/backend/src/modules/material/dto/material-query.dto.ts`
- `apps/backend/src/modules/material/dto/audit-material.dto.ts`
- `apps/backend/src/modules/program/program.module.ts`
- `apps/backend/src/modules/program/program.controller.ts`
- `apps/backend/src/modules/program/program.service.ts`
- `apps/backend/src/modules/program/dto/program-query.dto.ts`
- `apps/backend/src/modules/program/dto/create-program.dto.ts`
- `apps/backend/src/modules/program/dto/update-program.dto.ts`
- `apps/backend/src/modules/publish/publish.module.ts`
- `apps/backend/src/modules/publish/publish.controller.ts`
- `apps/backend/src/modules/publish/publish.service.ts`
- `apps/backend/src/modules/publish/dto/publish-query.dto.ts`
- `apps/backend/src/modules/publish/dto/create-publish-plan.dto.ts`
- `apps/backend/src/modules/publish/dto/update-publish-plan.dto.ts`
- `apps/backend/src/modules/publish/dto/update-publish-status.dto.ts`
- `apps/backend/src/modules/device-api/device-api.module.ts`
- `apps/backend/src/modules/device-api/device-api.controller.ts`
- `apps/backend/src/modules/device-api/device-api.service.ts`
- `apps/backend/prisma/seed.ts` — create default admin and default role.
- `apps/backend/src/test/test-app.ts` — test app bootstrap helper for integration tests.
- `apps/backend/src/test/auth.helper.ts` — login helper for integration tests.
- `apps/backend/src/**/*.spec.ts` — service and API integration tests per module.

### Backend files to modify

- `apps/backend/prisma/schema.prisma` — align models/enums with PRD and technical design.
- `apps/backend/package.json` — add seed/test scripts if needed.
- `apps/backend/src/app.module.ts` — import real business modules.
- `apps/backend/src/main.ts` — static uploads serving, global filter constructor, response format.
- `apps/backend/src/interceptors/transform.interceptor.ts` — success response uses `code: 0` and numeric timestamp.
- `apps/backend/src/filters/all-exceptions.filter.ts` — error response uses business code and numeric timestamp.
- `apps/backend/src/modules/prisma/prisma.service.ts` — update `cleanDatabase()` model order after schema changes.

### Frontend files to create

- `apps/admin/src/api/auth.ts`
- `apps/admin/src/api/store.ts`
- `apps/admin/src/api/device.ts`
- `apps/admin/src/api/material.ts`
- `apps/admin/src/api/program.ts`
- `apps/admin/src/api/publish.ts`
- `apps/admin/src/utils/date.ts`
- `apps/admin/src/utils/file.ts`
- `apps/admin/src/utils/options.ts`
- `apps/admin/src/views/store/StoreList.vue`
- `apps/admin/src/views/device/DeviceList.vue`
- `apps/admin/src/views/material/MaterialList.vue`
- `apps/admin/src/views/program/ProgramList.vue`
- `apps/admin/src/views/publish/PublishList.vue`

### Frontend files to modify

- `apps/admin/src/utils/request.ts` — only accept `code === 0`.
- `apps/admin/src/stores/user.ts` — persist token/user consistently and expose logout.
- `apps/admin/src/views/auth/Login.vue` — use `src/api/auth.ts`, remove mock comment.
- `apps/admin/src/layouts/MainLayout.vue` — hide unfinished system menu; keep static MVP menu.
- `apps/admin/src/router/index.ts` — ensure routes point to created pages.
- `apps/admin/src/assets/styles/main.scss` — add common page/table/form helpers if needed.

### Shared package and docs to modify

- `packages/types/src/index.ts` — shared enum/type alignment, `ApiResponse.timestamp: number`, request DTO types.
- `packages/shared/src/constants.ts` — status constants aligned to spec.
- `docs/requirements/信发系统_产品需求文档.md` — only if PRD conflicts with technical design in MVP scope.
- `docs/architecture/信发系统_技术设计文档.md` — update any MVP-scope conflicts discovered during implementation.
- `docs/api/README.md` or new docs under `docs/api/` — document implemented MVP endpoints if existing API docs need sync.
- `docs/superpowers/reviews/2026-06-25-adspread-admin-backend-mvp-verification.md` — final verification evidence.

---

## 2. Implementation tasks

### Task 1: Create feature branch and confirm baseline

**Files:**

- Read: `package.json`
- Read: `apps/backend/package.json`
- Read: `apps/admin/package.json`
- Read: `apps/backend/prisma/schema.prisma`
- Modify: no source files unless branch creation is needed

- [ ] **Step 1: Check working tree**

Run:

```bash
git status --short
git branch --show-current
```

Expected:

- Current branch is visible.
- Existing user changes are identified before edits. At plan time `CLAUDE.md` was modified; do not overwrite it.

- [ ] **Step 2: Create implementation branch if still on `main`**

Run only if current branch is `main` and user has not forbidden branch creation:

```bash
git switch -c feat/admin-backend-mvp
```

Expected:

- New branch `feat/admin-backend-mvp` is active.

- [ ] **Step 3: Run baseline build commands**

Run:

```bash
npm run build --workspace=@adspread/backend
npm run build --workspace=@adspread/admin
```

Expected:

- If either fails due missing modules referenced by `app.module.ts` or missing frontend views, record the error in the implementation notes. Do not fix unrelated failures until the task that owns them.

---

### Task 2: Align shared constants and response contract

**Files:**

- Modify: `packages/types/src/index.ts`
- Modify: `packages/shared/src/constants.ts`
- Modify: `apps/backend/src/interceptors/transform.interceptor.ts`
- Modify: `apps/backend/src/filters/all-exceptions.filter.ts`
- Modify: `apps/admin/src/utils/request.ts`
- Test: backend build, admin build after implementation

- [ ] **Step 1: Update shared API response type**

In `packages/types/src/index.ts`, change `ApiResponse.timestamp` from `string` to `number` and add explicit MVP status constants/types. Use these exact exported types and enums as the target shape:

```ts
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
}

export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export enum Status {
  DISABLED = 0,
  ENABLED = 1,
}

export enum ProgramStatus {
  DRAFT = 0,
  PUBLISHED = 1,
}

export enum PublishPlanStatus {
  DISABLED = 0,
  ENABLED = 1,
}
```

Expected:

- No remaining `timestamp: string` for API response.
- `ProgramStatus` uses `0/1`, not `1/2`.

- [ ] **Step 2: Update shared constants**

In `packages/shared/src/constants.ts`, replace program and publish status constants with:

```ts
export const STATUS_ENABLED = 1;
export const STATUS_DISABLED = 0;

export const DEVICE_STATUS_ENABLED = 1;
export const DEVICE_STATUS_DISABLED = 0;

export const PROGRAM_STATUS_DRAFT = 0;
export const PROGRAM_STATUS_PUBLISHED = 1;

export const PUBLISH_STATUS_DISABLED = 0;
export const PUBLISH_STATUS_ENABLED = 1;
```

Expected:

- No `PUBLISH_STATUS_PENDING`, `PUBLISH_STATUS_PUSHED`, or `PUBLISH_STATUS_EXPIRED` remains.
- No `PROGRAM_STATUS_DRAFT = 1` remains.

- [ ] **Step 3: Add backend business error helpers**

Create `apps/backend/src/common/errors/business-error-codes.ts`:

```ts
export const BusinessErrorCode = {
  PARAM_ERROR: 40001,
  VALIDATION_ERROR: 40002,
  DUPLICATE_RESOURCE: 40003,
  BUSINESS_RULE_VIOLATION: 40004,
  UNAUTHORIZED: 40101,
  TOKEN_INVALID: 40102,
  FORBIDDEN: 40301,
  NOT_FOUND: 40401,
  INTERNAL_ERROR: 50001,
} as const;

export type BusinessErrorCodeValue = (typeof BusinessErrorCode)[keyof typeof BusinessErrorCode];
```

Create `apps/backend/src/common/errors/business.exception.ts`:

```ts
import { HttpException, HttpStatus } from '@nestjs/common';
import { BusinessErrorCode, type BusinessErrorCodeValue } from './business-error-codes';

export class BusinessException extends HttpException {
  constructor(
    message: string,
    public readonly businessCode: BusinessErrorCodeValue = BusinessErrorCode.BUSINESS_RULE_VIOLATION,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details: unknown = null
  ) {
    super({ code: businessCode, message, data: details }, status);
  }
}
```

- [ ] **Step 4: Update success transform interceptor**

Replace `apps/backend/src/interceptors/transform.interceptor.ts` body shape with:

```ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface Response<T> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => ({
        code: 0,
        message: 'success',
        data,
        timestamp: Date.now(),
      }))
    );
  }
}
```

- [ ] **Step 5: Update exception filter**

Modify `apps/backend/src/filters/all-exceptions.filter.ts` so `ErrorResponse` is:

```ts
interface ErrorResponse {
  code: number;
  message: string;
  data: unknown;
  timestamp: number;
  path: string;
  method: string;
}
```

Use this logic inside `catch()` after computing `httpStatus`:

```ts
const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : null;

const responseObject =
  typeof exceptionResponse === 'object' && exceptionResponse !== null
    ? (exceptionResponse as Record<string, unknown>)
    : {};

const code =
  typeof responseObject.code === 'number'
    ? responseObject.code
    : httpStatus >= 500
      ? 50001
      : httpStatus === 401
        ? 40101
        : httpStatus === 403
          ? 40301
          : httpStatus === 404
            ? 40401
            : 40001;

const message =
  typeof responseObject.message === 'string'
    ? responseObject.message
    : exception instanceof HttpException
      ? exception.message
      : 'Internal server error';

const responseBody: ErrorResponse = {
  code,
  message,
  data: responseObject.data ?? null,
  timestamp: Date.now(),
  path: httpAdapter.getRequestUrl(request),
  method: httpAdapter.getRequestMethod(request),
};
```

Expected:

- Error response has numeric `timestamp` and `data`.
- HTTP status remains proper status code, while body code uses business code.

- [ ] **Step 6: Update frontend request success check**

In `apps/admin/src/utils/request.ts`, replace response success check with:

```ts
const { code, message, data } = response.data;

if (code === 0) {
  return data;
}

ElMessage.error(message || '请求失败');
return Promise.reject(new Error(message || '请求失败'));
```

Expected:

- No `code === 200` remains.

- [ ] **Step 7: Verify contract changes**

Run:

```bash
npm run build --workspace=@adspread/backend
npm run build --workspace=@adspread/admin
```

Expected:

- Backend may still fail if missing modules exist; if so, record exact missing module messages for Task 4+.
- Admin may still fail if missing views exist; if so, record exact missing view messages for frontend tasks.

---

### Task 3: Align Prisma schema and seed data

**Files:**

- Modify: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/prisma/seed.ts`
- Modify: `apps/backend/package.json`
- Modify: `apps/backend/src/modules/prisma/prisma.service.ts`
- Modify: `packages/types/src/index.ts`
- Modify: `docs/architecture/信发系统_技术设计文档.md` if implementation discovers doc conflict in MVP scope

- [ ] **Step 1: Update Prisma enums**

In `apps/backend/prisma/schema.prisma`, update enums to include document-aligned values:

```prisma
enum IndustryCategory {
  CATERING      // 餐饮
  RETAIL        // 零售
  BEAUTY        // 美妆
  HOSPITALITY   // 酒旅
  EDUCATION     // 教育
  AUTOMOTIVE    // 汽车
  LOCAL_LIFE    // 本地生活
  OTHER         // 其他
}

enum ScreenOrientation {
  LANDSCAPE // 横屏
  PORTRAIT  // 竖屏
  ANY       // 任意
}

enum SplitType {
  SPLIT_1
  SPLIT_2
  SPLIT_3
  SPLIT_3_1
  SPLIT_4
  ANY
}

enum MaterialType {
  IMAGE
  VIDEO
}

enum AuditStatus {
  PENDING
  APPROVED
  REJECTED
}
```

Expected:

- No `HOTEL`, `LIFE_SERVICE`, `SPLIT_2_H`, `SPLIT_2_V`, `SPLIT_3_H`, or `SPLIT_3_V` remains.

- [ ] **Step 2: Update `Device` model**

Change `Device` model fields to this shape:

```prisma
model Device {
  id                Int               @id @default(autoincrement())
  storeId           Int?
  name              String            @db.VarChar(100)
  code              String            @unique @db.VarChar(50)
  screenOrientation ScreenOrientation @default(LANDSCAPE)
  screenResolution  String            @db.VarChar(20)
  splitType         SplitType         @default(SPLIT_1)
  remark            String?           @db.Text
  status            Int               @default(1) // 1: 启用, 0: 禁用
  lastActiveAt      DateTime?
  ipAddress         String?           @db.VarChar(50)
  macAddress        String?           @db.VarChar(20)
  appVersion        String?           @db.VarChar(20)
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  store             Store?            @relation(fields: [storeId], references: [id], onDelete: SetNull)

  @@index([storeId])
  @@index([status])
  @@map("devices")
}
```

Expected:

- `storeId` is nullable.
- Relation is nullable.
- `onDelete` is `SetNull`, not `Cascade`.
- `screenResolution` is required.

- [ ] **Step 3: Update `Material.fileSize`**

Change:

```prisma
fileSize        Int
```

to:

```prisma
fileSize        BigInt        // 文件大小(字节)
```

Expected:

- Prisma client exposes `fileSize` as bigint in backend; API serialization must convert it to number or string later. MVP should return number for <=100MB files.

- [ ] **Step 4: Update `Program` defaults and status comment**

Use:

```prisma
screenOrientation ScreenOrientation @default(ANY)
splitType         SplitType         @default(ANY)
status            Int               @default(0) // 0: 草稿, 1: 已发布
```

Expected:

- Program draft status is `0`.
- Published status is `1`.

- [ ] **Step 5: Update `PublishPlan` model status and playDays**

Use:

```prisma
playDays        Json          // JSON array of days: [1,2,3,4,5] = Mon-Fri
status          Int           @default(1) // 1: 启用, 0: 停用
```

Expected:

- `playDays` is required.
- Status comment uses enabled/disabled.

- [ ] **Step 6: Add simplified push log model**

Add to schema:

```prisma
model PushMessageLog {
  id                Int      @id @default(autoincrement())
  publishPlanId     Int?
  targetDeviceCount Int      @default(0)
  messageType        String   @db.VarChar(50)
  content            Json?
  status             Int      @default(1) // 1: 已记录, 0: 失败
  createdBy          Int?
  createdAt          DateTime @default(now())

  publishPlan        PublishPlan? @relation(fields: [publishPlanId], references: [id], onDelete: SetNull)
  creator            Admin?       @relation(fields: [createdBy], references: [id], onDelete: SetNull)

  @@index([publishPlanId])
  @@index([createdAt])
  @@map("push_message_logs")
}
```

Also add relations:

```prisma
// in Admin
pushMessageLogs PushMessageLog[]

// in PublishPlan
pushMessageLogs PushMessageLog[]
```

Expected:

- MVP push result is auditable without real WebSocket.

- [ ] **Step 7: Add Prisma seed script**

Create `apps/backend/prisma/seed.ts`:

```ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

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
```

- [ ] **Step 8: Add seed script to backend package**

In `apps/backend/package.json`, add scripts:

```json
"prisma:seed": "ts-node prisma/seed.ts"
```

Add Prisma seed config at package root:

```json
"prisma": {
  "seed": "ts-node prisma/seed.ts"
}
```

Expected:

- `npm run prisma:seed --workspace=@adspread/backend` runs seed.

- [ ] **Step 9: Update Prisma cleanDatabase order**

In `apps/backend/src/modules/prisma/prisma.service.ts`, include push logs first:

```ts
const models = [
  this.pushMessageLog,
  this.operationLog,
  this.publishPlan,
  this.program,
  this.material,
  this.device,
  this.store,
  this.admin,
  this.role,
  this.menu,
];
```

- [ ] **Step 10: Generate Prisma client and migration**

Run:

```bash
npm run prisma:generate --workspace=@adspread/backend
npm run prisma:migrate --workspace=@adspread/backend
```

Expected:

- Prisma client generated.
- Migration created for schema changes.
- If database is unavailable, record this and defer migration execution, but schema file must be valid.

---

### Task 4: Add backend common utilities and auth

**Files:**

- Create: `apps/backend/src/common/decorators/current-user.decorator.ts`
- Create: `apps/backend/src/common/guards/jwt-auth.guard.ts`
- Create: `apps/backend/src/common/constants/business.constants.ts`
- Create: `apps/backend/src/modules/auth/*`
- Modify: `apps/backend/src/app.module.ts`
- Test: `apps/backend/src/modules/auth/auth.service.spec.ts`
- Test: `apps/backend/src/modules/auth/auth.controller.spec.ts`

- [ ] **Step 1: Create business constants**

Create `apps/backend/src/common/constants/business.constants.ts`:

```ts
export const STATUS_DISABLED = 0;
export const STATUS_ENABLED = 1;

export const PROGRAM_STATUS_DRAFT = 0;
export const PROGRAM_STATUS_PUBLISHED = 1;

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const MATERIAL_MAX_FILE_SIZE = 100 * 1024 * 1024;
export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif'];
export const VIDEO_EXTENSIONS = ['mp4', 'avi', 'mov'];
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
export const VIDEO_MIME_TYPES = ['video/mp4', 'video/x-msvideo', 'video/quicktime'];

export const PORTRAIT_SPLIT_TYPES = ['SPLIT_1', 'SPLIT_2', 'SPLIT_3'];
export const LANDSCAPE_SPLIT_TYPES = ['SPLIT_1', 'SPLIT_2', 'SPLIT_3', 'SPLIT_3_1', 'SPLIT_4'];
```

- [ ] **Step 2: Create current user decorator**

Create `apps/backend/src/common/decorators/current-user.decorator.ts`:

```ts
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
```

- [ ] **Step 3: Create JWT auth guard**

Create `apps/backend/src/common/guards/jwt-auth.guard.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

- [ ] **Step 4: Create login DTO**

Create `apps/backend/src/modules/auth/dto/login.dto.ts`:

```ts
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  username!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
```

- [ ] **Step 5: Write auth service unit tests first**

Create `apps/backend/src/modules/auth/auth.service.spec.ts` with tests for success and failure:

```ts
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  const prisma = {
    admin: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;

  const jwtService = {
    signAsync: jest.fn(),
  } as unknown as JwtService;

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(prisma, jwtService);
  });

  it('rejects missing admin', async () => {
    (prisma.admin.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.login('missing', 'admin123', '127.0.0.1')).rejects.toThrow(
      '用户名或密码错误'
    );
  });

  it('rejects disabled admin', async () => {
    (prisma.admin.findUnique as jest.Mock).mockResolvedValue({ status: 0 });

    await expect(service.login('admin', 'admin123', '127.0.0.1')).rejects.toThrow('账号已禁用');
  });

  it('rejects bad password', async () => {
    (prisma.admin.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      username: 'admin',
      passwordHash: 'hash',
      name: '系统管理员',
      roleId: 1,
      status: 1,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(service.login('admin', 'bad', '127.0.0.1')).rejects.toThrow('用户名或密码错误');
  });

  it('returns token and user info on success', async () => {
    (prisma.admin.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      username: 'admin',
      passwordHash: 'hash',
      name: '系统管理员',
      roleId: 1,
      status: 1,
      avatar: null,
      phone: null,
      email: null,
      lastLoginAt: null,
      lastLoginIp: null,
      createdAt: new Date('2026-06-25T00:00:00.000Z'),
      updatedAt: new Date('2026-06-25T00:00:00.000Z'),
      role: { id: 1, name: '超级管理员' },
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (jwtService.signAsync as jest.Mock).mockResolvedValue('jwt-token');
    (prisma.admin.update as jest.Mock).mockResolvedValue({});

    const result = await service.login('admin', 'admin123', '127.0.0.1');

    expect(result.token).toBe('jwt-token');
    expect(result.userInfo.username).toBe('admin');
    expect(result.userInfo.passwordHash).toBeUndefined();
  });
});
```

- [ ] **Step 6: Run failing auth tests**

Run:

```bash
npm run test --workspace=@adspread/backend -- auth.service.spec.ts
```

Expected:

- Fails because `AuthService` does not exist yet.

- [ ] **Step 7: Implement AuthService**

Create `apps/backend/src/modules/auth/auth.service.ts`:

```ts
import { Injectable, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../../common/errors/business.exception';
import { BusinessErrorCode } from '../../common/errors/business-error-codes';
import { STATUS_ENABLED } from '../../common/constants/business.constants';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async login(username: string, password: string, ip?: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { username },
      include: { role: true },
    });

    if (!admin) {
      throw new BusinessException(
        '用户名或密码错误',
        BusinessErrorCode.UNAUTHORIZED,
        HttpStatus.UNAUTHORIZED
      );
    }

    if (admin.status !== STATUS_ENABLED) {
      throw new BusinessException('账号已禁用', BusinessErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }

    const passwordOk = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordOk) {
      throw new BusinessException(
        '用户名或密码错误',
        BusinessErrorCode.UNAUTHORIZED,
        HttpStatus.UNAUTHORIZED
      );
    }

    await this.prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip },
    });

    const token = await this.jwtService.signAsync({
      sub: admin.id,
      username: admin.username,
      name: admin.name,
      roleId: admin.roleId,
    });

    const { passwordHash, ...userInfo } = admin;

    return {
      token,
      userInfo,
    };
  }
}
```

- [ ] **Step 8: Implement JWT strategy**

Create `apps/backend/src/modules/auth/jwt.strategy.ts`:

```ts
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
```

- [ ] **Step 9: Implement AuthController and module**

Create `apps/backend/src/modules/auth/auth.controller.ts`:

```ts
import { Body, Controller, Ip, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.authService.login(dto.username, dto.password, ip);
  }
}
```

Create `apps/backend/src/modules/auth/auth.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'adspread-dev-secret',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 10: Run auth tests again**

Run:

```bash
npm run test --workspace=@adspread/backend -- auth.service.spec.ts
```

Expected:

- PASS.

---

### Task 5: Add backend pagination, layout helpers, and test app helpers

**Files:**

- Create: `apps/backend/src/common/utils/pagination.ts`
- Create: `apps/backend/src/common/utils/layout.ts`
- Create: `apps/backend/src/common/utils/file.ts`
- Create: `apps/backend/src/test/test-app.ts`
- Create: `apps/backend/src/test/auth.helper.ts`

- [ ] **Step 1: Create pagination helper**

Create `apps/backend/src/common/utils/pagination.ts`:

```ts
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants/business.constants';

export interface PaginationInput {
  page?: number;
  pageSize?: number;
}

export function getPagination(input: PaginationInput) {
  const page = Math.max(Number(input.page) || DEFAULT_PAGE, 1);
  const pageSize = Math.min(
    Math.max(Number(input.pageSize) || DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE
  );
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip, take: pageSize };
}

export function paginated<T>(list: T[], total: number, page: number, pageSize: number) {
  return { list, total, page, pageSize };
}
```

- [ ] **Step 2: Create layout helper with tests**

Create `apps/backend/src/common/utils/layout.ts`:

```ts
import { ScreenOrientation, SplitType } from '@prisma/client';
import { LANDSCAPE_SPLIT_TYPES, PORTRAIT_SPLIT_TYPES } from '../constants/business.constants';
import { BusinessException } from '../errors/business.exception';

export interface RegionBounds {
  regionId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function validateSplitType(screenOrientation: ScreenOrientation, splitType: SplitType) {
  if (screenOrientation === ScreenOrientation.ANY || splitType === SplitType.ANY) return;

  const allowed =
    screenOrientation === ScreenOrientation.PORTRAIT ? PORTRAIT_SPLIT_TYPES : LANDSCAPE_SPLIT_TYPES;

  if (!allowed.includes(splitType)) {
    throw new BusinessException('屏幕方向与分屏类型不匹配');
  }
}

export function getRegionCount(splitType: SplitType) {
  switch (splitType) {
    case SplitType.SPLIT_1:
      return 1;
    case SplitType.SPLIT_2:
      return 2;
    case SplitType.SPLIT_3:
    case SplitType.SPLIT_3_1:
      return 3;
    case SplitType.SPLIT_4:
      return 4;
    case SplitType.ANY:
      return 0;
    default:
      return 0;
  }
}

export function getRegionBounds(
  screenOrientation: ScreenOrientation,
  splitType: SplitType
): RegionBounds[] {
  if (splitType === SplitType.ANY) return [];

  if (splitType === SplitType.SPLIT_1) {
    return [{ regionId: 'region1', x: 0, y: 0, width: 1, height: 1 }];
  }

  if (splitType === SplitType.SPLIT_2) {
    return screenOrientation === ScreenOrientation.PORTRAIT
      ? [
          { regionId: 'region1', x: 0, y: 0, width: 1, height: 0.5 },
          { regionId: 'region2', x: 0, y: 0.5, width: 1, height: 0.5 },
        ]
      : [
          { regionId: 'region1', x: 0, y: 0, width: 0.5, height: 1 },
          { regionId: 'region2', x: 0.5, y: 0, width: 0.5, height: 1 },
        ];
  }

  if (splitType === SplitType.SPLIT_3) {
    return screenOrientation === ScreenOrientation.PORTRAIT
      ? [
          { regionId: 'region1', x: 0, y: 0, width: 1, height: 1 / 3 },
          { regionId: 'region2', x: 0, y: 1 / 3, width: 1, height: 1 / 3 },
          { regionId: 'region3', x: 0, y: 2 / 3, width: 1, height: 1 / 3 },
        ]
      : [
          { regionId: 'region1', x: 0, y: 0, width: 1 / 3, height: 1 },
          { regionId: 'region2', x: 1 / 3, y: 0, width: 1 / 3, height: 1 },
          { regionId: 'region3', x: 2 / 3, y: 0, width: 1 / 3, height: 1 },
        ];
  }

  if (splitType === SplitType.SPLIT_3_1) {
    return [
      { regionId: 'region1', x: 0, y: 0, width: 0.5, height: 1 },
      { regionId: 'region2', x: 0.5, y: 0, width: 0.5, height: 0.5 },
      { regionId: 'region3', x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
    ];
  }

  return [
    { regionId: 'region1', x: 0, y: 0, width: 0.5, height: 0.5 },
    { regionId: 'region2', x: 0.5, y: 0, width: 0.5, height: 0.5 },
    { regionId: 'region3', x: 0, y: 0.5, width: 0.5, height: 0.5 },
    { regionId: 'region4', x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
  ];
}
```

- [ ] **Step 3: Create file helper**

Create `apps/backend/src/common/utils/file.ts`:

```ts
import { extname } from 'path';
import {
  IMAGE_EXTENSIONS,
  IMAGE_MIME_TYPES,
  MATERIAL_MAX_FILE_SIZE,
  VIDEO_EXTENSIONS,
  VIDEO_MIME_TYPES,
} from '../constants/business.constants';
import { BusinessException } from '../errors/business.exception';

export function getLowerExtension(filename: string) {
  return extname(filename).replace('.', '').toLowerCase();
}

export function getMaterialType(filename: string, mimetype: string): 'IMAGE' | 'VIDEO' {
  const ext = getLowerExtension(filename);
  if (IMAGE_EXTENSIONS.includes(ext) && IMAGE_MIME_TYPES.includes(mimetype)) return 'IMAGE';
  if (VIDEO_EXTENSIONS.includes(ext) && VIDEO_MIME_TYPES.includes(mimetype)) return 'VIDEO';
  throw new BusinessException('不支持的素材文件类型');
}

export function assertMaterialFile(file: Express.Multer.File) {
  if (!file) throw new BusinessException('请选择上传文件');
  if (file.size > MATERIAL_MAX_FILE_SIZE) throw new BusinessException('素材文件不能超过100MB');
  return getMaterialType(file.originalname, file.mimetype);
}
```

- [ ] **Step 4: Create test app helper**

Create `apps/backend/src/test/test-app.ts`:

```ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { AllExceptionsFilter } from '../filters/all-exceptions.filter';
import { TransformInterceptor } from '../interceptors/transform.interceptor';
import { HttpAdapterHost } from '@nestjs/core';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));

  await app.init();
  return app;
}
```

- [ ] **Step 5: Create auth test helper**

Create `apps/backend/src/test/auth.helper.ts`:

```ts
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';

export async function loginAndGetToken(app: INestApplication) {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' })
    .expect(201);

  return response.body.data.token as string;
}
```

---

### Task 6: Implement Store backend

**Files:**

- Create: `apps/backend/src/modules/store/*`
- Modify: `apps/backend/src/app.module.ts` if import path needs adjustment
- Test: `apps/backend/src/modules/store/store.service.spec.ts`

- [ ] **Step 1: Create Store DTOs**

Create `apps/backend/src/modules/store/dto/create-store.dto.ts`:

```ts
import { IndustryCategory } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateStoreDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(50)
  code!: string;

  @IsEnum(IndustryCategory)
  industryCategory!: IndustryCategory;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPerson?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string;

  @IsOptional()
  @IsInt()
  status?: number;

  @IsOptional()
  @IsString()
  remark?: string;
}
```

Create `apps/backend/src/modules/store/dto/update-store.dto.ts`:

```ts
import { PartialType } from '@nestjs/swagger';
import { CreateStoreDto } from './create-store.dto';

export class UpdateStoreDto extends PartialType(CreateStoreDto) {}
```

Create `apps/backend/src/modules/store/dto/store-query.dto.ts`:

```ts
import { IndustryCategory } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class StoreQueryDto {
  @IsOptional()
  @IsInt()
  page?: number;

  @IsOptional()
  @IsInt()
  pageSize?: number;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsEnum(IndustryCategory)
  industryCategory?: IndustryCategory;

  @IsOptional()
  @IsInt()
  status?: number;
}
```

- [ ] **Step 2: Write StoreService tests**

Create `apps/backend/src/modules/store/store.service.spec.ts` with tests for duplicate code and delete protection:

```ts
import { StoreService } from './store.service';
import { PrismaService } from '../prisma/prisma.service';
import { IndustryCategory } from '@prisma/client';

describe('StoreService', () => {
  const prisma = {
    store: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    device: {
      count: jest.fn(),
    },
  } as unknown as PrismaService;

  let service: StoreService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StoreService(prisma);
  });

  it('rejects duplicate store code on create', async () => {
    (prisma.store.findFirst as jest.Mock).mockResolvedValue({ id: 1 });

    await expect(
      service.create({ name: '涩谷店', code: 'SH001', industryCategory: IndustryCategory.CATERING })
    ).rejects.toThrow('门店编码已存在');
  });

  it('creates store when code is unique', async () => {
    (prisma.store.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.store.create as jest.Mock).mockResolvedValue({ id: 1, code: 'SH001' });

    const result = await service.create({
      name: '涩谷店',
      code: 'SH001',
      industryCategory: IndustryCategory.CATERING,
    });

    expect(result.id).toBe(1);
  });

  it('rejects deleting a store that has devices', async () => {
    (prisma.store.findUnique as jest.Mock).mockResolvedValue({ id: 1 });
    (prisma.device.count as jest.Mock).mockResolvedValue(1);

    await expect(service.remove(1)).rejects.toThrow('门店下存在设备，无法删除');
  });
});
```

- [ ] **Step 3: Run failing StoreService tests**

Run:

```bash
npm run test --workspace=@adspread/backend -- store.service.spec.ts
```

Expected:

- Fails because `StoreService` is not implemented.

- [ ] **Step 4: Implement StoreService**

Create `apps/backend/src/modules/store/store.service.ts` implementing:

```ts
import { Injectable } from '@nestjs/common';
import { Prisma, Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../../common/errors/business.exception';
import { getPagination, paginated } from '../../common/utils/pagination';
import { CreateStoreDto } from './dto/create-store.dto';
import { StoreQueryDto } from './dto/store-query.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

@Injectable()
export class StoreService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: StoreQueryDto) {
    const { page, pageSize, skip, take } = getPagination(query);
    const where: Prisma.StoreWhereInput = {};

    if (query.keyword) {
      where.OR = [{ name: { contains: query.keyword } }, { code: { contains: query.keyword } }];
    }
    if (query.industryCategory) where.industryCategory = query.industryCategory;
    if (typeof query.status === 'number') where.status = query.status;

    const [list, total] = await Promise.all([
      this.prisma.store.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { devices: true } } },
      }),
      this.prisma.store.count({ where }),
    ]);

    return paginated(
      list.map((item) => ({ ...item, deviceCount: item._count.devices })),
      total,
      page,
      pageSize
    );
  }

  async create(dto: CreateStoreDto) {
    await this.assertCodeUnique(dto.code);
    return this.prisma.store.create({ data: dto });
  }

  async update(id: number, dto: UpdateStoreDto) {
    await this.assertExists(id);
    if (dto.code) await this.assertCodeUnique(dto.code, id);
    return this.prisma.store.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.assertExists(id);
    const deviceCount = await this.prisma.device.count({ where: { storeId: id } });
    if (deviceCount > 0) throw new BusinessException('门店下存在设备，无法删除');
    return this.prisma.store.delete({ where: { id } });
  }

  async options() {
    return this.prisma.store.findMany({
      where: { status: 1 },
      select: { id: true, name: true, code: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  industryCategories() {
    return [
      { value: 'CATERING', label: '餐饮', labelJa: '飲食', labelEn: 'Catering' },
      { value: 'RETAIL', label: '零售', labelJa: '小売', labelEn: 'Retail' },
      { value: 'BEAUTY', label: '美妆', labelJa: '美容', labelEn: 'Beauty' },
      { value: 'HOSPITALITY', label: '酒旅', labelJa: '宿泊・旅行', labelEn: 'Hospitality' },
      { value: 'EDUCATION', label: '教育', labelJa: '教育', labelEn: 'Education' },
      { value: 'AUTOMOTIVE', label: '汽车', labelJa: '自動車', labelEn: 'Automotive' },
      { value: 'LOCAL_LIFE', label: '本地生活', labelJa: 'ローカルライフ', labelEn: 'Local Life' },
      { value: 'OTHER', label: '其他', labelJa: 'その他', labelEn: 'Other' },
    ];
  }

  private async assertExists(id: number): Promise<Store> {
    const store = await this.prisma.store.findUnique({ where: { id } });
    if (!store) throw new BusinessException('门店不存在');
    return store;
  }

  private async assertCodeUnique(code: string, excludeId?: number) {
    const existing = await this.prisma.store.findFirst({
      where: { code, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (existing) throw new BusinessException('门店编码已存在');
  }
}
```

- [ ] **Step 5: Implement StoreController and module**

Create `apps/backend/src/modules/store/store.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateStoreDto } from './dto/create-store.dto';
import { StoreQueryDto } from './dto/store-query.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { StoreService } from './store.service';

@UseGuards(JwtAuthGuard)
@Controller('stores')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get()
  findAll(@Query() query: StoreQueryDto) {
    return this.storeService.findAll(query);
  }

  @Get('industry-categories')
  industryCategories() {
    return this.storeService.industryCategories();
  }

  @Get('options')
  options() {
    return this.storeService.options();
  }

  @Post()
  create(@Body() dto: CreateStoreDto) {
    return this.storeService.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStoreDto) {
    return this.storeService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.storeService.remove(id);
  }
}
```

Create `apps/backend/src/modules/store/store.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';

@Module({
  imports: [PrismaModule],
  controllers: [StoreController],
  providers: [StoreService],
  exports: [StoreService],
})
export class StoreModule {}
```

- [ ] **Step 6: Run StoreService tests**

Run:

```bash
npm run test --workspace=@adspread/backend -- store.service.spec.ts
```

Expected:

- PASS.

---

### Task 7: Implement Device backend

**Files:**

- Create: `apps/backend/src/modules/device/*`
- Test: `apps/backend/src/modules/device/device.service.spec.ts`

- [ ] **Step 1: Create Device DTOs**

Create `apps/backend/src/modules/device/dto/create-device.dto.ts`:

```ts
import { ScreenOrientation, SplitType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDeviceDto {
  @IsOptional()
  @IsInt()
  storeId?: number;

  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(50)
  code!: string;

  @IsEnum(ScreenOrientation)
  screenOrientation!: ScreenOrientation;

  @IsString()
  @MaxLength(20)
  screenResolution!: string;

  @IsEnum(SplitType)
  splitType!: SplitType;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsInt()
  status?: number;
}
```

Create `update-device.dto.ts` via `PartialType(CreateDeviceDto)` and `device-query.dto.ts` with `page`, `pageSize`, `keyword`, `storeId`, `status`.

- [ ] **Step 2: Write DeviceService tests**

Create tests covering nullable store and split validation:

```ts
import { ScreenOrientation, SplitType } from '@prisma/client';
import { DeviceService } from './device.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DeviceService', () => {
  const prisma = {
    device: { findFirst: jest.fn(), create: jest.fn() },
    store: { findUnique: jest.fn() },
  } as unknown as PrismaService;

  let service: DeviceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DeviceService(prisma);
  });

  it('creates a device without store', async () => {
    (prisma.device.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.device.create as jest.Mock).mockResolvedValue({ id: 1, storeId: null });

    const result = await service.create({
      name: '设备1',
      code: 'DEVICE001',
      screenOrientation: ScreenOrientation.LANDSCAPE,
      screenResolution: '1920x1080',
      splitType: SplitType.SPLIT_3_1,
    });

    expect(result.storeId).toBeNull();
  });

  it('rejects portrait 4 split', async () => {
    (prisma.device.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.create({
        name: '设备1',
        code: 'DEVICE001',
        screenOrientation: ScreenOrientation.PORTRAIT,
        screenResolution: '1080x1920',
        splitType: SplitType.SPLIT_4,
      })
    ).rejects.toThrow('屏幕方向与分屏类型不匹配');
  });
});
```

- [ ] **Step 3: Implement DeviceService**

Create service with these required methods:

```ts
async create(dto: CreateDeviceDto) {
  await this.assertCodeUnique(dto.code);
  await this.assertStoreExists(dto.storeId);
  validateSplitType(dto.screenOrientation, dto.splitType);
  return this.prisma.device.create({ data: { ...dto, storeId: dto.storeId ?? null } });
}

async update(id: number, dto: UpdateDeviceDto) {
  await this.assertExists(id);
  if (dto.code) await this.assertCodeUnique(dto.code, id);
  await this.assertStoreExists(dto.storeId);
  if (dto.screenOrientation && dto.splitType) validateSplitType(dto.screenOrientation, dto.splitType);
  return this.prisma.device.update({ where: { id }, data: { ...dto, storeId: dto.storeId ?? undefined } });
}
```

Also implement `findAll`, `remove`, `resolutions`, `splitTypes`, `assertExists`, `assertCodeUnique`, and `assertStoreExists`.

Use this exact resolutions return value:

```ts
return ['1920x1080', '1080x1920', '3840x2160', '2160x3840'];
```

- [ ] **Step 4: Implement DeviceController and module**

Routes:

- `GET /api/devices`
- `GET /api/devices/resolutions`
- `GET /api/devices/split-types`
- `POST /api/devices`
- `PUT /api/devices/:id`
- `DELETE /api/devices/:id`

All routes use `JwtAuthGuard`.

- [ ] **Step 5: Run DeviceService tests**

Run:

```bash
npm run test --workspace=@adspread/backend -- device.service.spec.ts
```

Expected: PASS.

---

### Task 8: Implement Material backend upload and audit

**Files:**

- Create: `apps/backend/src/modules/material/*`
- Modify: `apps/backend/src/main.ts`
- Test: `apps/backend/src/modules/material/material.service.spec.ts`

- [ ] **Step 1: Serve uploads statically**

Modify `apps/backend/src/main.ts` to import `join` and use static assets:

```ts
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
```

Change app creation:

```ts
const app = await NestFactory.create<NestExpressApplication>(AppModule);
```

After CORS config, add:

```ts
app.useStaticAssets(join(process.cwd(), 'uploads'), {
  prefix: '/uploads/',
});
```

- [ ] **Step 2: Create Material DTOs**

Create `material-query.dto.ts`:

```ts
import { AuditStatus, MaterialType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class MaterialQueryDto {
  @IsOptional()
  @IsInt()
  page?: number;

  @IsOptional()
  @IsInt()
  pageSize?: number;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsEnum(MaterialType)
  type?: MaterialType;

  @IsOptional()
  @IsEnum(AuditStatus)
  auditStatus?: AuditStatus;
}
```

Create `audit-material.dto.ts`:

```ts
import { IsOptional, IsString, MinLength } from 'class-validator';

export class RejectMaterialDto {
  @IsString()
  @MinLength(10)
  reason!: string;
}

export class ApproveMaterialDto {
  @IsOptional()
  @IsString()
  note?: string;
}
```

- [ ] **Step 3: Write MaterialService tests**

Create tests for reject reason and approve clearing old reason:

```ts
import { AuditStatus } from '@prisma/client';
import { MaterialService } from './material.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MaterialService', () => {
  const prisma = {
    material: { findUnique: jest.fn(), update: jest.fn() },
    program: { count: jest.fn() },
  } as unknown as PrismaService;

  let service: MaterialService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MaterialService(prisma);
  });

  it('rejects short audit rejection reason', async () => {
    await expect(service.reject(1, 1, '太短')).rejects.toThrow('驳回原因至少10个字符');
  });

  it('approves material and clears old reason', async () => {
    (prisma.material.findUnique as jest.Mock).mockResolvedValue({ id: 1 });
    (prisma.material.update as jest.Mock).mockResolvedValue({
      id: 1,
      auditStatus: AuditStatus.APPROVED,
    });

    const result = await service.approve(1, 2);

    expect(prisma.material.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        auditStatus: AuditStatus.APPROVED,
        auditUserId: 2,
        auditTime: expect.any(Date),
        auditReason: null,
      },
    });
    expect(result.auditStatus).toBe(AuditStatus.APPROVED);
  });
});
```

- [ ] **Step 4: Implement MaterialService**

Required methods:

- `findAll(query)` with pagination and filters.
- `available()` returns approved materials.
- `upload(file, adminId)` validates file and creates material with `PENDING`.
- `approve(id, adminId)`.
- `reject(id, adminId, reason)`.
- `remove(id)` rejects deletion if any program `layoutConfig` references material ID.

For upload path generation, use:

```ts
const date = new Date();
const yyyy = String(date.getFullYear());
const mm = String(date.getMonth() + 1).padStart(2, '0');
const dd = String(date.getDate()).padStart(2, '0');
const dir = join(process.cwd(), 'uploads', 'materials', yyyy, mm, dd);
await mkdir(dir, { recursive: true });
const filename = `${randomUUID()}.${extension}`;
const fullPath = join(dir, filename);
await writeFile(fullPath, file.buffer);
const fileUrl = `/uploads/materials/${yyyy}/${mm}/${dd}/${filename}`;
```

Convert file size for Prisma:

```ts
fileSize: BigInt(file.size);
```

When returning material records, convert bigint to number:

```ts
private serializeMaterial<T extends { fileSize: bigint }>(material: T) {
  return { ...material, fileSize: Number(material.fileSize) };
}
```

- [ ] **Step 5: Implement MaterialController and module**

Controller routes:

- `GET /api/materials`
- `GET /api/materials/available`
- `POST /api/materials/upload` with `FileInterceptor('file')`
- `POST /api/materials/:id/approve`
- `POST /api/materials/:id/reject`
- `DELETE /api/materials/:id`

Use `@CurrentUser('id') adminId: number` on protected routes.

- [ ] **Step 6: Run MaterialService tests**

Run:

```bash
npm run test --workspace=@adspread/backend -- material.service.spec.ts
```

Expected: PASS.

---

### Task 9: Implement Program backend

**Files:**

- Create: `apps/backend/src/modules/program/*`
- Test: `apps/backend/src/modules/program/program.service.spec.ts`

- [ ] **Step 1: Create Program DTOs**

Create `create-program.dto.ts`:

```ts
import { ScreenOrientation, SplitType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ProgramRegionMaterialDto {
  @IsInt()
  materialId!: number;

  @IsInt()
  @Min(1)
  duration!: number;
}

export class ProgramRegionDto {
  @IsString()
  regionId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProgramRegionMaterialDto)
  materials!: ProgramRegionMaterialDto[];
}

export class CreateProgramDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsEnum(ScreenOrientation)
  screenOrientation!: ScreenOrientation;

  @IsEnum(SplitType)
  splitType!: SplitType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProgramRegionDto)
  regions!: ProgramRegionDto[];

  @IsOptional()
  @IsInt()
  status?: number;
}

export class PublishProgramDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProgramRegionDto)
  regions!: ProgramRegionDto[];
}
```

Create `update-program.dto.ts` via `PartialType(CreateProgramDto)` and query DTO with `keyword`, `status`, `page`, `pageSize`.

- [ ] **Step 2: Write ProgramService tests**

Create tests for publish validation:

```ts
import { AuditStatus, ScreenOrientation, SplitType } from '@prisma/client';
import { ProgramService } from './program.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProgramService', () => {
  const prisma = {
    material: { findMany: jest.fn() },
    program: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    publishPlan: { count: jest.fn() },
  } as unknown as PrismaService;

  let service: ProgramService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProgramService(prisma);
  });

  it('rejects publishing with unapproved material', async () => {
    (prisma.material.findMany as jest.Mock).mockResolvedValue([
      { id: 1, auditStatus: AuditStatus.PENDING },
    ]);

    await expect(
      service.create(
        {
          name: '节目1',
          screenOrientation: ScreenOrientation.LANDSCAPE,
          splitType: SplitType.SPLIT_1,
          regions: [{ regionId: 'region1', materials: [{ materialId: 1, duration: 5 }] }],
          status: 1,
        },
        1
      )
    ).rejects.toThrow('节目只能使用审核通过的素材');
  });

  it('creates draft with empty regions', async () => {
    (prisma.program.create as jest.Mock).mockResolvedValue({ id: 1, status: 0 });

    const result = await service.create(
      {
        name: '草稿',
        screenOrientation: ScreenOrientation.ANY,
        splitType: SplitType.ANY,
        regions: [],
        status: 0,
      },
      1
    );

    expect(result.status).toBe(0);
  });
});
```

- [ ] **Step 3: Implement ProgramService**

Required behavior:

- Store `layoutConfig` as `{ regions: dto.regions }`.
- For status `1`, validate every actual region has at least one material.
- Validate all material IDs exist and are `APPROVED` before publish.
- `publish(id, dto)` sets `status = 1` and `publishedAt = new Date()`.
- `remove(id)` rejects if `publishPlan.count({ where: { programId: id } }) > 0`.

Use helper:

```ts
private getMaterialIds(regions: Array<{ materials: Array<{ materialId: number }> }>) {
  return [...new Set(regions.flatMap((region) => region.materials.map((item) => item.materialId)))];
}
```

- [ ] **Step 4: Implement ProgramController and module**

Routes:

- `GET /api/programs`
- `POST /api/programs`
- `PUT /api/programs/:id`
- `POST /api/programs/:id/publish`
- `DELETE /api/programs/:id`

All routes use JWT guard.

- [ ] **Step 5: Run ProgramService tests**

Run:

```bash
npm run test --workspace=@adspread/backend -- program.service.spec.ts
```

Expected: PASS.

---

### Task 10: Implement Publish backend and device program API

**Files:**

- Create: `apps/backend/src/modules/publish/*`
- Create: `apps/backend/src/modules/device-api/*`
- Test: `apps/backend/src/modules/publish/publish.service.spec.ts`
- Test: `apps/backend/src/modules/device-api/device-api.service.spec.ts`

- [ ] **Step 1: Create publish DTOs**

Create `create-publish-plan.dto.ts`:

```ts
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePublishPlanDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsInt()
  programId!: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  targetStoreIds!: number[];

  @IsDateString()
  startTime!: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(1, { each: true })
  playDays!: number[];

  @IsOptional()
  @IsInt()
  status?: number;
}
```

Create `update-publish-plan.dto.ts` via `PartialType(CreatePublishPlanDto)`, `update-publish-status.dto.ts` with `status`, and query DTO.

- [ ] **Step 2: Write PublishService tests**

Create tests for only published program and playDays:

```ts
import { PublishService } from './publish.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PublishService', () => {
  const prisma = {
    program: { findUnique: jest.fn() },
    store: { count: jest.fn() },
    publishPlan: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    device: { count: jest.fn() },
    pushMessageLog: { create: jest.fn() },
  } as unknown as PrismaService;

  let service: PublishService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PublishService(prisma);
  });

  it('rejects draft program', async () => {
    (prisma.program.findUnique as jest.Mock).mockResolvedValue({ id: 1, status: 0 });

    await expect(
      service.create(
        {
          name: '计划1',
          programId: 1,
          targetStoreIds: [1],
          startTime: '2026-06-25T00:00:00.000Z',
          playDays: [1],
        },
        1
      )
    ).rejects.toThrow('只能选择已发布节目');
  });

  it('pushes plan and returns target device count', async () => {
    (prisma.publishPlan.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      targetStoreIds: [1, 2],
    });
    (prisma.device.count as jest.Mock).mockResolvedValue(3);
    (prisma.publishPlan.update as jest.Mock).mockResolvedValue({ id: 1 });
    (prisma.pushMessageLog.create as jest.Mock).mockResolvedValue({ id: 10 });

    const result = await service.push(1, 1);

    expect(result.targetDeviceCount).toBe(3);
    expect(result.pushLogId).toBe(10);
  });
});
```

- [ ] **Step 3: Implement PublishService**

Required methods:

- `findAll(query)`.
- `create(dto, adminId)`.
- `update(id, dto)`.
- `updateStatus(id, status)`.
- `remove(id)`.
- `push(id, adminId)`.
- `batchPush(ids, adminId)`.

Validation:

```ts
if (program.status !== PROGRAM_STATUS_PUBLISHED) throw new BusinessException('只能选择已发布节目');
if (dto.endTime && new Date(dto.endTime) <= new Date(dto.startTime))
  throw new BusinessException('结束时间必须晚于开始时间');
if (!dto.playDays?.length) throw new BusinessException('播放周期至少选择一天');
```

For push:

```ts
const targetDeviceCount = await this.prisma.device.count({
  where: { storeId: { in: targetStoreIds }, status: STATUS_ENABLED },
});
const updated = await this.prisma.publishPlan.update({
  where: { id },
  data: { lastPushedAt: new Date() },
});
const log = await this.prisma.pushMessageLog.create({
  data: {
    publishPlanId: id,
    targetDeviceCount,
    messageType: 'program_update',
    status: 1,
    createdBy: adminId,
    content: { reason: 'manual_push', targetStoreIds },
  },
});
return { targetDeviceCount, pushLogId: log.id, lastPushedAt: updated.lastPushedAt };
```

- [ ] **Step 4: Implement PublishController and module**

Routes:

- `GET /api/publish`
- `POST /api/publish`
- `PUT /api/publish/:id`
- `PATCH /api/publish/:id/status`
- `DELETE /api/publish/:id`
- `POST /api/publish/:id/push`
- `POST /api/publish/batch-push`

- [ ] **Step 5: Implement DeviceApiService**

Create `apps/backend/src/modules/device-api/device-api.service.ts` with behavior from spec:

- device not found → `BusinessException('设备不存在', NOT_FOUND, 404)`.
- device disabled/no store/store disabled → return `null`.
- find enabled publish plans containing store ID.
- filter current time and weekday.
- order latest created first.
- return program with region bounds and materials.

Use current weekday as Monday=1 ... Sunday=7:

```ts
private getTodayPlayDay(now = new Date()) {
  const day = now.getDay();
  return day === 0 ? 7 : day;
}
```

When checking JSON `targetStoreIds`, MySQL JSON filtering can be awkward. For MVP, fetch enabled plans and filter in TypeScript:

```ts
const plans = await this.prisma.publishPlan.findMany({
  where: { status: STATUS_ENABLED },
  include: { program: true },
  orderBy: { createdAt: 'desc' },
});
const plan = plans.find((candidate) => {
  const targetStoreIds = candidate.targetStoreIds as number[];
  const playDays = candidate.playDays as number[];
  return targetStoreIds.includes(storeId) && this.isPlanActive(candidate, playDays, now);
});
```

- [ ] **Step 6: Implement DeviceApiController and module**

Create public route:

```ts
@Controller('device')
export class DeviceApiController {
  constructor(private readonly deviceApiService: DeviceApiService) {}

  @Get('program')
  currentProgram(@Query('deviceCode') deviceCode: string) {
    return this.deviceApiService.getCurrentProgram(deviceCode);
  }
}
```

- [ ] **Step 7: Run publish and device API tests**

Run:

```bash
npm run test --workspace=@adspread/backend -- publish.service.spec.ts device-api.service.spec.ts
```

Expected: PASS.

---

### Task 11: Implement frontend API layer and shared UI utilities

**Files:**

- Create: `apps/admin/src/api/*.ts`
- Create: `apps/admin/src/utils/date.ts`
- Create: `apps/admin/src/utils/file.ts`
- Create: `apps/admin/src/utils/options.ts`
- Modify: `apps/admin/src/utils/request.ts`

- [ ] **Step 1: Create date utility**

Create `apps/admin/src/utils/date.ts`:

```ts
import dayjs from 'dayjs';

export function formatDateTime(value?: string | Date | null) {
  if (!value) return '-';
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}
```

- [ ] **Step 2: Create file utility**

Create `apps/admin/src/utils/file.ts`:

```ts
export function formatFileSize(size?: number | string | null) {
  const bytes = Number(size || 0);
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
```

- [ ] **Step 3: Create options utility**

Create `apps/admin/src/utils/options.ts`:

```ts
import { ScreenOrientation, SplitType } from '@adspread/types';

export const statusOptions = [
  { label: '启用', value: 1 },
  { label: '禁用', value: 0 },
];

export const screenOrientationOptions = [
  { label: '横屏', value: ScreenOrientation.LANDSCAPE },
  { label: '竖屏', value: ScreenOrientation.PORTRAIT },
];

export const programScreenOrientationOptions = [
  ...screenOrientationOptions,
  { label: '任意', value: ScreenOrientation.ANY },
];

export const splitTypeOptions = [
  { label: '1分屏', value: SplitType.SPLIT_1 },
  { label: '2分屏', value: SplitType.SPLIT_2 },
  { label: '3分屏', value: SplitType.SPLIT_3 },
  { label: '3-1分屏', value: SplitType.SPLIT_3_1 },
  { label: '4分屏', value: SplitType.SPLIT_4 },
];

export const programSplitTypeOptions = [
  ...splitTypeOptions,
  { label: '任意', value: SplitType.ANY },
];

export function getDeviceSplitTypeOptions(orientation: ScreenOrientation) {
  if (orientation === ScreenOrientation.PORTRAIT) {
    return splitTypeOptions.filter((item) =>
      [SplitType.SPLIT_1, SplitType.SPLIT_2, SplitType.SPLIT_3].includes(item.value)
    );
  }
  return splitTypeOptions;
}
```

Also update `packages/types/src/index.ts` to include `ScreenOrientation.ANY`, `SplitType.SPLIT_3_1`, and `SplitType.ANY`.

- [ ] **Step 4: Create API modules**

Create `apps/admin/src/api/auth.ts`:

```ts
import { http } from '@/utils/request';
import type { LoginRequest, LoginResponse } from '@adspread/types';

export function loginApi(data: LoginRequest) {
  return http.post<LoginResponse>('/auth/login', data);
}
```

Create `store.ts`, `device.ts`, `material.ts`, `program.ts`, `publish.ts` using the same pattern:

```ts
import { http } from '@/utils/request';

export function getStores(params: Record<string, unknown>) {
  return http.get('/stores', { params });
}

export function createStore(data: Record<string, unknown>) {
  return http.post('/stores', data);
}

export function updateStore(id: number, data: Record<string, unknown>) {
  return http.put(`/stores/${id}`, data);
}

export function deleteStore(id: number) {
  return http.delete(`/stores/${id}`);
}
```

Repeat exact CRUD route names from the spec for other modules.

- [ ] **Step 5: Build admin**

Run:

```bash
npm run build --workspace=@adspread/admin
```

Expected:

- It may fail until pages exist; note missing imports and continue to frontend page tasks.

---

### Task 12: Implement login, layout, and routes

**Files:**

- Modify: `apps/admin/src/views/auth/Login.vue`
- Modify: `apps/admin/src/layouts/MainLayout.vue`
- Modify: `apps/admin/src/router/index.ts`
- Modify: `apps/admin/src/stores/user.ts`

- [ ] **Step 1: Update Login.vue to use API module**

Replace direct `http.post('/auth/login', loginForm)` with:

```ts
import { loginApi } from '@/api/auth';
```

and:

```ts
const response = await loginApi(loginForm);
const { token, userInfo } = response;
```

Remove comment `Mock login - will be replaced with actual API call`.

- [ ] **Step 2: Hide unfinished system menu**

In `apps/admin/src/layouts/MainLayout.vue`, remove or comment out the `<el-sub-menu index="/system">...</el-sub-menu>` block so MVP only shows completed routes.

Expected menu items:

- 仪表盘
- 门店管理
- 设备管理
- 素材管理
- 节目制作
- 发布管理

- [ ] **Step 3: Ensure router points to MVP pages**

In `apps/admin/src/router/index.ts`, keep routes:

```ts
{
  path: 'store',
  name: 'Store',
  component: () => import('@/views/store/StoreList.vue'),
  meta: { title: 'menu.store', icon: 'Shop' },
},
{
  path: 'device',
  name: 'Device',
  component: () => import('@/views/device/DeviceList.vue'),
  meta: { title: 'menu.device', icon: 'Monitor' },
},
{
  path: 'material',
  name: 'Material',
  component: () => import('@/views/material/MaterialList.vue'),
  meta: { title: 'menu.material', icon: 'Picture' },
},
{
  path: 'program',
  name: 'Program',
  component: () => import('@/views/program/ProgramList.vue'),
  meta: { title: 'menu.program', icon: 'Film' },
},
{
  path: 'publish',
  name: 'Publish',
  component: () => import('@/views/publish/PublishList.vue'),
  meta: { title: 'menu.publish', icon: 'Promotion' },
}
```

Remove system child routes from MVP router or leave them unreachable only if corresponding pages exist. Prefer removal from MVP router to avoid missing file build errors.

- [ ] **Step 4: Build admin after page tasks exist**

Do not run final admin build until Task 13 creates the missing pages.

---

### Task 13: Implement Store and Device frontend pages

**Files:**

- Create: `apps/admin/src/views/store/StoreList.vue`
- Create: `apps/admin/src/views/device/DeviceList.vue`
- Modify: API modules as needed

- [ ] **Step 1: Create StoreList.vue page skeleton**

Create `apps/admin/src/views/store/StoreList.vue` with this structure:

```vue
<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>门店管理</span>
          <el-button type="primary" @click="openCreate">新增门店</el-button>
        </div>
      </template>

      <el-form :inline="true" :model="query">
        <el-form-item label="关键词">
          <el-input v-model="query.keyword" placeholder="门店名称/编码" clearable />
        </el-form-item>
        <el-form-item label="行业分类">
          <el-select
            v-model="query.industryCategory"
            placeholder="全部"
            clearable
            style="width: 160px"
          >
            <el-option
              v-for="item in industryOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width: 120px">
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchData">查询</el-button>
          <el-button @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="loading" :data="list">
        <el-table-column prop="name" label="门店名称" />
        <el-table-column prop="code" label="门店编码" />
        <el-table-column label="行业分类">
          <template #default="{ row }">{{ getIndustryLabel(row.industryCategory) }}</template>
        </el-table-column>
        <el-table-column prop="address" label="地址" />
        <el-table-column prop="contactPerson" label="联系人" />
        <el-table-column prop="contactPhone" label="联系电话" />
        <el-table-column label="状态">
          <template #default="{ row }"
            ><el-tag :type="row.status === 1 ? 'success' : 'danger'">{{
              row.status === 1 ? '启用' : '禁用'
            }}</el-tag></template
          >
        </el-table-column>
        <el-table-column prop="deviceCount" label="设备数" />
        <el-table-column label="创建时间"
          ><template #default="{ row }">{{
            formatDateTime(row.createdAt)
          }}</template></el-table-column
        >
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <el-pagination
          layout="total, sizes, prev, pager, next"
          :total="total"
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          @change="fetchData"
        />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑门店' : '新增门店'" width="520px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="门店名称" prop="name"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="门店编码" prop="code"><el-input v-model="form.code" /></el-form-item>
        <el-form-item label="行业分类" prop="industryCategory"
          ><el-select v-model="form.industryCategory" style="width: 100%"
            ><el-option
              v-for="item in industryOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value" /></el-select
        ></el-form-item>
        <el-form-item label="地址"><el-input v-model="form.address" /></el-form-item>
        <el-form-item label="联系人"><el-input v-model="form.contactPerson" /></el-form-item>
        <el-form-item label="联系电话"><el-input v-model="form.contactPhone" /></el-form-item>
        <el-form-item label="状态"
          ><el-switch v-model="form.status" :active-value="1" :inactive-value="0"
        /></el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="dialogVisible = false">取消</el-button
        ><el-button type="primary" @click="submitForm">保存</el-button></template
      >
    </el-dialog>
  </div>
</template>
```

Script must use `getStores`, `createStore`, `updateStore`, `deleteStore`, `getIndustryCategories`, `formatDateTime`, and Element Plus messages.

- [ ] **Step 2: Create DeviceList.vue page**

Use the same table/form pattern. Required behaviors:

- `storeId` select can be cleared.
- `screenResolution` is required.
- `splitTypeOptions` are computed from selected `screenOrientation` via `getDeviceSplitTypeOptions`.
- Watch `screenOrientation`; clear `splitType` if it is no longer allowed.

Implementation snippet for watcher:

```ts
watch(
  () => form.screenOrientation,
  (orientation) => {
    const allowed = getDeviceSplitTypeOptions(orientation).map((item) => item.value);
    if (!allowed.includes(form.splitType)) {
      form.splitType = undefined;
    }
  }
);
```

- [ ] **Step 3: Run admin build**

Run:

```bash
npm run build --workspace=@adspread/admin
```

Expected:

- Build may still fail because material/program/publish pages are missing; missing store/device errors should be resolved.

---

### Task 14: Implement Material, Program, and Publish frontend pages

**Files:**

- Create: `apps/admin/src/views/material/MaterialList.vue`
- Create: `apps/admin/src/views/program/ProgramList.vue`
- Create: `apps/admin/src/views/publish/PublishList.vue`

- [ ] **Step 1: Implement MaterialList.vue**

Required UI:

- Filter form: keyword, type, auditStatus.
- Upload button using `el-upload` with action built from API base URL and token header.
- Table columns: name, type, fileSize, fileExtension, auditStatus, auditTime, auditReason, createdAt, actions.
- Audit dialog: approve/reject; reject reason min length 10.

Use upload headers:

```ts
const uploadHeaders = computed(() => ({ Authorization: `Bearer ${userStore.token}` }));
```

Use upload action:

```ts
const uploadAction = `${import.meta.env.VITE_API_BASE_URL || '/api'}/materials/upload`;
```

- [ ] **Step 2: Implement ProgramList.vue**

Required UI:

- Filter form: keyword, status.
- Program form fields: name, screenOrientation, splitType.
- Regions UI: render cards based on selected splitType. If splitType is `ANY`, show a single logical configuration card and allow draft save; publishing requires user to choose actual split type first or backend rejects if regions cannot be determined.
- Material selector uses `/materials/available`.
- Save draft sends status `0`.
- Save and publish sends status `1` or calls `/programs/:id/publish` after save.

Use helper in component:

```ts
function getRegionIds(splitType: string) {
  if (splitType === 'SPLIT_1') return ['region1'];
  if (splitType === 'SPLIT_2') return ['region1', 'region2'];
  if (splitType === 'SPLIT_3' || splitType === 'SPLIT_3_1')
    return ['region1', 'region2', 'region3'];
  if (splitType === 'SPLIT_4') return ['region1', 'region2', 'region3', 'region4'];
  return [];
}
```

- [ ] **Step 3: Implement PublishList.vue**

Required UI:

- Filter form: keyword, status.
- Table selection for batch push.
- Form fields: name, programId, targetStoreIds, startTime, endTime, playDays, status.
- Program select uses published program list.
- Store select uses store options.
- Push action shows returned `targetDeviceCount` and `pushLogId`.

Use play day options:

```ts
const playDayOptions = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 7 },
];
```

- [ ] **Step 4: Run admin build**

Run:

```bash
npm run build --workspace=@adspread/admin
```

Expected:

- PASS. If failing, fix missing imports/types/routes before continuing.

---

### Task 15: Add backend integration tests

**Files:**

- Create: `apps/backend/src/modules/auth/auth.controller.spec.ts`
- Create: `apps/backend/src/modules/store/store.controller.spec.ts`
- Create: `apps/backend/src/modules/device/device.controller.spec.ts`
- Create: `apps/backend/src/modules/material/material.controller.spec.ts`
- Create: `apps/backend/src/modules/program/program.controller.spec.ts`
- Create: `apps/backend/src/modules/publish/publish.controller.spec.ts`
- Create: `apps/backend/src/modules/device-api/device-api.controller.spec.ts`

- [ ] **Step 1: Add auth integration test**

Create test:

```ts
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../../test/test-app';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('returns unified response for login', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    expect(response.body).toHaveProperty('code');
    expect(response.body).toHaveProperty('timestamp');
    expect(typeof response.body.timestamp).toBe('number');
  });
});
```

If default seed is not loaded in test DB, use Prisma in `beforeAll` to create the test admin with bcrypt hash.

- [ ] **Step 2: Add protected route test**

In store controller integration test:

```ts
await request(app.getHttpServer()).get('/api/stores').expect(401);
```

Then login and assert:

```ts
await request(app.getHttpServer())
  .get('/api/stores')
  .set('Authorization', `Bearer ${token}`)
  .expect(200)
  .expect((res) => {
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty('list');
  });
```

- [ ] **Step 3: Add MVP API integration paths**

Cover the paths listed in spec section 12.3:

- create store.
- create device without store.
- reject invalid device split.
- upload material with a small test buffer.
- approve material.
- create/publish program.
- create publish plan.
- push publish plan.
- get device current program.

Use one integration test file per module. Each test creates its own records and deletes them in `afterEach` or uses `prisma.cleanDatabase()` when `NODE_ENV !== 'production'`.

- [ ] **Step 4: Run integration tests**

Run:

```bash
npm run test --workspace=@adspread/backend -- --runInBand
```

Expected:

- PASS. If database connection is missing, configure test DATABASE_URL or record blocked verification in review file.

---

### Task 16: Sync docs and create verification record

**Files:**

- Modify: `docs/requirements/信发系统_产品需求文档.md` only if MVP-scope conflict discovered
- Modify: `docs/architecture/信发系统_技术设计文档.md` only if MVP-scope conflict discovered
- Create: `docs/superpowers/reviews/2026-06-25-adspread-admin-backend-mvp-verification.md`

- [ ] **Step 1: Search for response contract conflicts**

Use Grep tool or run:

```bash
rg "code: 200|code === 200|timestamp: string|待发布|已过期|SPLIT_2_H|SPLIT_2_V|SPLIT_3_H|SPLIT_3_V" docs apps packages
```

Expected:

- No MVP-scope conflicts remain.
- If matches exist in historical/version notes, do not edit unless they describe current behavior.

- [ ] **Step 2: Run backend verification**

Run:

```bash
npm run build --workspace=@adspread/backend
npm run test --workspace=@adspread/backend
```

Expected:

- Both PASS.

- [ ] **Step 3: Run frontend verification**

Run:

```bash
npm run build --workspace=@adspread/admin
```

If lint is configured and not blocked by unrelated pre-existing issues, run:

```bash
npm run lint --workspace=@adspread/backend
npm run lint --workspace=@adspread/admin
```

Expected:

- Build PASS.
- Lint PASS or documented with exact pre-existing failures.

- [ ] **Step 4: Create verification record**

Create `docs/superpowers/reviews/2026-06-25-adspread-admin-backend-mvp-verification.md`:

```md
# 信发系统管理端与服务端 MVP 验证记录

**日期**: 2026-06-25
**范围**: 管理端前端与对应服务端 MVP

## 自动化验证

| 命令                                          | 结果              | 备注         |
| --------------------------------------------- | ----------------- | ------------ |
| `npm run build --workspace=@adspread/backend` | PASS/FAIL         | 填写关键输出 |
| `npm run test --workspace=@adspread/backend`  | PASS/FAIL         | 填写关键输出 |
| `npm run build --workspace=@adspread/admin`   | PASS/FAIL         | 填写关键输出 |
| `npm run lint --workspace=@adspread/backend`  | PASS/FAIL/SKIPPED | 填写原因     |
| `npm run lint --workspace=@adspread/admin`    | PASS/FAIL/SKIPPED | 填写原因     |

## API 集成测试覆盖

- 登录
- 门店
- 设备
- 素材上传与审核
- 节目制作
- 发布计划与推送记录
- 设备当前节目接口

## 手工验收结果

- [ ] 登录与导航
- [ ] 门店管理
- [ ] 设备管理
- [ ] 素材管理
- [ ] 节目制作
- [ ] 发布管理
- [ ] 设备节目接口

## 未验证项

无未验证项，或列出具体原因。

## 已知问题

无已知问题，或列出具体问题和后续建议。
```

Replace `PASS/FAIL` placeholders with actual results before marking task complete.

- [ ] **Step 5: Final status check**

Run:

```bash
git status --short
```

Expected:

- Only task-related files changed.
- No accidental `node_modules`, uploads test files, or generated build output tracked.

---

## 3. Self-review checklist for the implementer

Before claiming completion:

- [ ] `docs/superpowers/specs/2026-06-25-adspread-admin-backend-mvp-design.md` requirements are covered by tasks above.
- [ ] PRD/technical design conflicts discovered during implementation were resolved in docs first.
- [ ] Backend success response uses `code: 0` and numeric `timestamp`.
- [ ] Frontend request accepts only `code === 0`.
- [ ] Prisma schema uses nullable device store, required screen resolution, publish status enabled/disabled, program status `0/1`.
- [ ] Store/device/material/program/publish backend tests pass.
- [ ] Admin build passes.
- [ ] Verification record exists under `docs/superpowers/reviews/` with real command results.
- [ ] Subagents did not run git commit.

---

## 4. Recommended commit grouping

Only commit after user authorization in the active session. Recommended commit groups:

1. `feat(contract): align shared response and prisma schema`
2. `feat(auth): add admin login and jwt guard`
3. `feat(store-device): implement store and device management`
4. `feat(material): add upload and audit workflow`
5. `feat(program): add program editing and publish validation`
6. `feat(publish): add publish plans and device program lookup`
7. `feat(admin): add mvp management pages`
8. `test(mvp): add backend service and api coverage`
9. `docs(mvp): add verification record`

Each commit message must end with:

```text
Co-Authored-By: Claude <noreply@anthropic.com>
```
