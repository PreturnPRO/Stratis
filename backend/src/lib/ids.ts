import { randomUUID } from "node:crypto";

export const newId = (prefix = ""): string =>
  prefix ? `${prefix}_${randomUUID()}` : randomUUID();

export const now = (): string => new Date().toISOString();
