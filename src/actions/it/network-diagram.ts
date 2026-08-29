'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { createDiagram, saveDiagramVersion } from '@/lib/it/network-diagram';
import { ItError } from '@/lib/it/errors';

export type FormState = { error?: string; success?: string } | undefined;

const CreateDiagramSchema = z.object({ name: z.string().trim().min(1, 'Ad gerekli.') });

export async function createDiagramAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'configure');
  const parsed = CreateDiagramSchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  await createDiagram(session.companyId, parsed.data.name);
  revalidatePath(`/dashboard/departments/${departmentId}/it/network-diagram`);
  return { success: 'Diyagram oluşturuldu.' };
}

const NodeSchema = z.object({
  clientId: z.string(), nodeType: z.enum(['FIREWALL', 'ROUTER', 'SWITCH', 'SERVER', 'ACCESS_POINT', 'PRINTER', 'COMPUTER', 'CAMERA', 'NVR', 'INTERNET', 'CLOUD']),
  linkedAssetId: z.string().optional(), label: z.string().optional(), positionX: z.number(), positionY: z.number()
});
const LinkSchema = z.object({ sourceClientId: z.string(), targetClientId: z.string(), port: z.string().optional(), vlanId: z.string().optional(), bandwidth: z.string().optional(), interfaceName: z.string().optional() });

// NETWORK.md §3 — her kaydetme, TÜM canvas durumunun yeni bir versiyonunu
// üretir (kısmi güncelleme yok). Bu yüzden düz FormData yerine tek bir JSON
// payload'ı — bir çizim editörünün doğal veri şekli.
export async function saveDiagramVersionAction(departmentId: string, diagramId: string, payload: { nodes: unknown[]; links: unknown[] }): Promise<{ error?: string; success?: string }> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');
  const nodesResult = z.array(NodeSchema).safeParse(payload.nodes);
  const linksResult = z.array(LinkSchema).safeParse(payload.links);
  if (!nodesResult.success || !linksResult.success) return { error: 'Geçersiz diyagram verisi.' };

  try {
    await saveDiagramVersion(session.companyId, { diagramId, createdBy: session.id, nodes: nodesResult.data, links: linksResult.data });
  } catch (err) {
    return { error: err instanceof ItError ? err.message : 'Diyagram kaydedilemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/it/network-diagram/${diagramId}`);
  return { success: 'Diyagram kaydedildi.' };
}
