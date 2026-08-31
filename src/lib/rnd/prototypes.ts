import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { rndPrototypes, projects } from '@/db/schema';
import { newId } from '@/lib/id';
import { nextDocumentNo } from '@/lib/numbering';
import { RndError } from './errors';

// Ar-Ge PROJESİ ayrı bir tablo olarak KURULMADI — Faz 8'in ZATEN var olan
// `projects` tablosu DOĞRUDAN kullanılır (§150). Prototip GERÇEKTEN yeni
// bir kavram, projects'e OPSİYONEL bağlanır.

export interface CreatePrototypeInput {
  projectId?: string;
  name: string;
  description?: string;
}

export async function createPrototype(companyId: string, createdByUserId: string, input: CreatePrototypeInput): Promise<string> {
  if (input.projectId) {
    const [project] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, input.projectId), eq(projects.companyId, companyId))).limit(1);
    if (!project) throw new RndError('Proje bulunamadı.');
  }

  return db.transaction(async (tx) => {
    const id = newId();
    const prototypeNo = await nextDocumentNo(tx, companyId, 'RNDP', 'PRT', new Date().getFullYear(), 6);
    await tx.insert(rndPrototypes).values({ id, companyId, projectId: input.projectId, prototypeNo, name: input.name, description: input.description, createdByUserId });
    return id;
  });
}

export async function listPrototypes(companyId: string) {
  return db
    .select({
      id: rndPrototypes.id, prototypeNo: rndPrototypes.prototypeNo, name: rndPrototypes.name, version: rndPrototypes.version,
      status: rndPrototypes.status, projectName: projects.name
    })
    .from(rndPrototypes)
    .leftJoin(projects, eq(projects.id, rndPrototypes.projectId))
    .where(eq(rndPrototypes.companyId, companyId))
    .orderBy(desc(rndPrototypes.createdAt));
}

async function getPrototype(companyId: string, prototypeId: string) {
  const [row] = await db.select().from(rndPrototypes).where(and(eq(rndPrototypes.id, prototypeId), eq(rndPrototypes.companyId, companyId))).limit(1);
  if (!row) throw new RndError('Prototip bulunamadı.');
  return row;
}

const TERMINAL_PROTOTYPE_STATUSES = ['APPROVED', 'REJECTED'] as const;

export async function updatePrototypeStatus(companyId: string, prototypeId: string, status: (typeof rndPrototypes.$inferSelect)['status']): Promise<void> {
  const prototype = await getPrototype(companyId, prototypeId);
  if ((TERMINAL_PROTOTYPE_STATUSES as readonly string[]).includes(prototype.status)) throw new RndError('Onaylanmış/reddedilmiş bir prototipin durumu değiştirilemez.');
  await db.update(rndPrototypes).set({ status }).where(eq(rndPrototypes.id, prototypeId));
}

// Yeni bir tasarım revizyonu — proc_quotations'ın "eski silinmez, yeni
// versiyon" ilkesiyle AYNI desen DEĞİL (burada AYNI satır güncelleniyor,
// prototip GEÇMİŞİ ayrı bir tabloda tutulmuyor — bu fazın kapsamı bunu
// gerektirmiyor, dürüstçe basit tutuldu), yalnızca version SAYACI artırılır.
export async function incrementPrototypeVersion(companyId: string, prototypeId: string): Promise<void> {
  const prototype = await getPrototype(companyId, prototypeId);
  await db.update(rndPrototypes).set({ version: prototype.version + 1 }).where(eq(rndPrototypes.id, prototypeId));
}
