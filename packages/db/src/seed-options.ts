export type SeedOptions = { timestamp?: string | undefined }

export function seedTimestamps({ timestamp }: SeedOptions): { createdAt?: string; updatedAt?: string } {
  return timestamp === undefined ? {} : { createdAt: timestamp, updatedAt: timestamp }
}
