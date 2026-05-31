import { Prisma } from '@prisma/client';

// Helper to convert Record<string, unknown> to Prisma's InputJsonValue
export function toJsonValue(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}

// Helper to convert to nullable JSON value
export function toNullableJsonValue(
  value: Record<string, unknown> | null | undefined
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}
