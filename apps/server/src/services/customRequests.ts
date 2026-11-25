import { db } from "../db/index.js";
import { customRequests } from "../db/schema.js";

export interface CustomRequestInput {
  name: string;
  contact: string;
  details: string;
  referenceUrl?: string;
}

export async function createCustomRequest(input: CustomRequestInput) {
  const [created] = await db
    .insert(customRequests)
    .values({
      name: input.name,
      contact: input.contact,
      details: input.details,
      referenceUrl: input.referenceUrl?.trim() || null,
      status: "new",
    })
    .returning();

  if (!created) {
    throw new Error("Failed to store custom request.");
  }

  return {
    id: created.id,
    status: created.status,
    createdAt: created.createdAt.toISOString(),
  };
}
