import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { itLocations } from '@/db/schema';
import { newId } from '@/lib/id';

// Holding ERP Faz 7 (Tesis) — it_locations'ın İLK GERÇEK tüketicisi.
// IT-DATABASE.md §1'in building→floor→room→rack→desk zinciri Faz 4/5'ten
// beri şemada duruyordu ama hiçbir create/list fonksiyonu yoktu (inv_
// reservations'ın Faz 2A'da "henüz gerçek tüketicisi yok" notuyla
// kurulup Faz 1'de gerçek ilk tüketicisini bulmasıyla AYNI desen).

export interface CreateLocationInput {
  locationType: (typeof itLocations.$inferInsert)['locationType'];
  name: string;
  branchId?: string;
  parentLocationId?: string;
  rackUnits?: number;
}

export async function createLocation(companyId: string, input: CreateLocationInput): Promise<string> {
  const id = newId();
  await db.insert(itLocations).values({
    id, companyId, branchId: input.branchId, parentLocationId: input.parentLocationId,
    locationType: input.locationType, name: input.name, rackUnits: input.rackUnits
  });
  return id;
}

export async function listLocations(companyId: string) {
  return db.select().from(itLocations).where(eq(itLocations.companyId, companyId));
}
