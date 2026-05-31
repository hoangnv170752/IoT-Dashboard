import { Prisma } from '@prisma/client';
// Helper to convert Record<string, unknown> to Prisma's InputJsonValue
export function toJsonValue(value) {
    if (value === undefined)
        return undefined;
    return value;
}
// Helper to convert to nullable JSON value
export function toNullableJsonValue(value) {
    if (value === undefined)
        return undefined;
    if (value === null)
        return Prisma.JsonNull;
    return value;
}
//# sourceMappingURL=json.js.map