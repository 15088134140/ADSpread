import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { OperationLogInterceptor } from './operation-log.interceptor';
import { OperationLogService } from '../../modules/system/log/operation-log.service';

describe('OperationLogInterceptor', () => {
  const create = jest.fn().mockResolvedValue(undefined);
  const logService = { create } as unknown as OperationLogService;
  const get = jest.fn();
  const reflector = { get } as unknown as Reflector;
  let interceptor: OperationLogInterceptor;

  const buildContext = (
    request: Record<string, unknown>,
    handler: unknown = jest.fn()
  ): ExecutionContext => {
    const switchToHttp = jest.fn().mockReturnValue({ getRequest: () => request });
    return {
      getHandler: () => handler,
      switchToHttp,
    } as unknown as ExecutionContext;
  };

  const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    jest.clearAllMocks();
    create.mockResolvedValue(undefined);
    interceptor = new OperationLogInterceptor(reflector, logService);
  });

  it('passes through without writing log when metadata missing', async () => {
    get.mockReturnValue(undefined);
    const ctx = buildContext({
      method: 'GET',
      ip: '1.1.1.1',
      headers: {},
      body: {},
      params: {},
    });
    const next: CallHandler = { handle: () => of({ ok: 1 }) };

    const result = await lastValueFrom(interceptor.intercept(ctx, next));
    expect(result).toEqual({ ok: 1 });
    await flushMicrotasks();
    expect(create).not.toHaveBeenCalled();
  });

  it('writes success log with status=1 and correct fields', async () => {
    get.mockReturnValue({ operation: '创建门店', targetType: 'store' });
    const request = {
      method: 'POST',
      ip: '127.0.0.1',
      headers: { 'user-agent': 'jest-agent' },
      body: { name: 'A' },
      params: { id: '5' },
      user: { id: 7, username: 'admin', name: '管理员', roleId: 2 },
    };
    const ctx = buildContext(request);
    const next: CallHandler = { handle: () => of({ ok: 1 }) };

    await lastValueFrom(interceptor.intercept(ctx, next));
    await flushMicrotasks();

    expect(create).toHaveBeenCalledTimes(1);
    const arg = create.mock.calls[0][0];
    expect(arg.status).toBe(1);
    expect(arg.operation).toBe('创建门店');
    expect(arg.method).toBe('POST');
    expect(arg.adminId).toBe(7);
    expect(arg.username).toBe('admin');
    expect(arg.roleId).toBe(2);
    expect(arg.ip).toBe('127.0.0.1');
    expect(arg.userAgent).toBe('jest-agent');
    expect(arg.params).toEqual({ name: 'A', id: '5' });
    expect(arg.errorMsg).toBeUndefined();
    expect(typeof arg.time).toBe('number');
  });

  it('writes failure log with status=0 and rethrows original error', async () => {
    get.mockReturnValue({ operation: '删除门店' });
    const request = {
      method: 'DELETE',
      ip: '127.0.0.1',
      headers: {},
      body: {},
      params: { id: '9' },
      user: { id: 7, username: 'admin', name: '管理员' },
    };
    const ctx = buildContext(request);
    const error = new Error('boom');
    const next: CallHandler = { handle: () => throwError(() => error) };

    await expect(lastValueFrom(interceptor.intercept(ctx, next))).rejects.toThrow('boom');
    await flushMicrotasks();

    expect(create).toHaveBeenCalledTimes(1);
    const arg = create.mock.calls[0][0];
    expect(arg.status).toBe(0);
    expect(arg.errorMsg).toBe('boom');
    expect(arg.operation).toBe('删除门店');
    expect(arg.method).toBe('DELETE');
    expect(arg.adminId).toBe(7);
  });

  it('masks password/oldPassword/newPassword in params', async () => {
    get.mockReturnValue({ operation: '修改密码' });
    const request = {
      method: 'POST',
      ip: '127.0.0.1',
      headers: {},
      body: {
        password: 'secret',
        oldPassword: 'old',
        newPassword: 'new',
        username: 'admin',
      },
      params: {},
      user: { id: 1, username: 'admin', name: '管理员' },
    };
    const ctx = buildContext(request);
    const next: CallHandler = { handle: () => of({ ok: 1 }) };

    await lastValueFrom(interceptor.intercept(ctx, next));
    await flushMicrotasks();

    const arg = create.mock.calls[0][0];
    expect(arg.params).toEqual({
      password: '***',
      oldPassword: '***',
      newPassword: '***',
      username: 'admin',
    });
  });

  it('handles anonymous request without user', async () => {
    get.mockReturnValue({ operation: '匿名操作' });
    const request = {
      method: 'GET',
      ip: '10.0.0.1',
      headers: {},
      body: {},
      params: {},
      // 无 user
    };
    const ctx = buildContext(request);
    const next: CallHandler = { handle: () => of({ ok: 1 }) };

    await lastValueFrom(interceptor.intercept(ctx, next));
    await flushMicrotasks();

    const arg = create.mock.calls[0][0];
    expect(arg.adminId).toBeUndefined();
    expect(arg.username).toBeUndefined();
    expect(arg.roleId).toBeUndefined();
    expect(arg.status).toBe(1);
  });
});
