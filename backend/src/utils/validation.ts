import { z } from 'zod';

export const uuidSchema = z.uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(160).optional(),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export function paginationMeta(total: number, input: PaginationInput) {
  return {
    page: input.page,
    pageSize: input.pageSize,
    total,
    pageCount: Math.ceil(total / input.pageSize),
  };
}
