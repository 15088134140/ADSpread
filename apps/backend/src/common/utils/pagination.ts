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
