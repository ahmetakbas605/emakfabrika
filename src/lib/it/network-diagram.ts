import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import type { Tx } from '@/db/client';
import { networkDiagrams, diagramVersions, networkNodes, networkLinks, itAssets, networkVlans } from '@/db/schema';
import { newId } from '@/lib/id';
import { ItError } from '@/lib/it/errors';

// NETWORK.md §3 — her düzenleme YENİ bir versiyon açar, eski versiyon
// SİLİNMEZ (financial immutability ilkesiyle AYNI disiplin, burada "ağ
// konfigürasyon geçmişi" için).

export async function createDiagram(companyId: string, name: string): Promise<string> {
  const id = newId();
  await db.insert(networkDiagrams).values({ id, companyId, name });
  return id;
}

export async function listDiagrams(companyId: string) {
  return db.select({ id: networkDiagrams.id, name: networkDiagrams.name, currentVersionId: networkDiagrams.currentVersionId }).from(networkDiagrams).where(eq(networkDiagrams.companyId, companyId));
}

export interface DiagramNodeInput {
  clientId: string; // frontend'in geçici node id'si — link'lerin source/target'ını eşlemek için
  nodeType: (typeof networkNodes.$inferInsert)['nodeType'];
  linkedAssetId?: string;
  label?: string;
  positionX: number;
  positionY: number;
}

export interface DiagramLinkInput {
  sourceClientId: string;
  targetClientId: string;
  port?: string;
  vlanId?: string;
  bandwidth?: string;
  interfaceName?: string;
}

export interface SaveDiagramVersionInput {
  diagramId: string;
  createdBy: string;
  nodes: DiagramNodeInput[];
  links: DiagramLinkInput[];
}

// Bir düzenleme, TÜM canvas state'ini (nodes+links) yeni bir versiyona
// yazar — kısmi güncelleme YOK, her "kaydet" tam bir snapshot üretir
// (network diagram'ın kendi doğası: bir arayüzden gelen tam durum).
export async function saveDiagramVersion(companyId: string, input: SaveDiagramVersionInput): Promise<string> {
  const [diagram] = await db.select({ id: networkDiagrams.id }).from(networkDiagrams).where(and(eq(networkDiagrams.id, input.diagramId), eq(networkDiagrams.companyId, companyId))).limit(1);
  if (!diagram) throw new ItError('Diyagram bulunamadı.');

  return db.transaction(async (tx: Tx) => {
    const [lastVersion] = await tx.select({ versionNo: diagramVersions.versionNo }).from(diagramVersions).where(eq(diagramVersions.diagramId, input.diagramId)).orderBy(desc(diagramVersions.versionNo)).limit(1);
    const versionNo = (lastVersion?.versionNo ?? 0) + 1;

    const versionId = newId();
    await tx.insert(diagramVersions).values({ id: versionId, diagramId: input.diagramId, versionNo, createdBy: input.createdBy });

    const clientIdToRealId = new Map<string, string>();
    for (const node of input.nodes) {
      const nodeId = newId();
      clientIdToRealId.set(node.clientId, nodeId);
      await tx.insert(networkNodes).values({
        id: nodeId, diagramVersionId: versionId, nodeType: node.nodeType, linkedAssetId: node.linkedAssetId,
        label: node.label ?? '', positionX: Math.round(node.positionX), positionY: Math.round(node.positionY)
      });
    }

    for (const link of input.links) {
      const sourceId = clientIdToRealId.get(link.sourceClientId);
      const targetId = clientIdToRealId.get(link.targetClientId);
      if (!sourceId || !targetId) throw new ItError('Bağlantı geçersiz bir düğüme işaret ediyor.');
      await tx.insert(networkLinks).values({ id: newId(), diagramVersionId: versionId, sourceNodeId: sourceId, targetNodeId: targetId, port: link.port ?? '', vlanId: link.vlanId, bandwidth: link.bandwidth ?? '', interfaceName: link.interfaceName ?? '' });
    }

    await tx.update(networkDiagrams).set({ currentVersionId: versionId }).where(eq(networkDiagrams.id, input.diagramId));
    return versionId;
  });
}

export async function getDiagramCurrentState(companyId: string, diagramId: string) {
  const [diagram] = await db.select().from(networkDiagrams).where(and(eq(networkDiagrams.id, diagramId), eq(networkDiagrams.companyId, companyId))).limit(1);
  if (!diagram) throw new ItError('Diyagram bulunamadı.');
  if (!diagram.currentVersionId) return { diagram, nodes: [], links: [] };

  const nodes = await db
    .select({ id: networkNodes.id, nodeType: networkNodes.nodeType, linkedAssetId: networkNodes.linkedAssetId, assetTag: itAssets.assetTag, label: networkNodes.label, positionX: networkNodes.positionX, positionY: networkNodes.positionY })
    .from(networkNodes)
    .leftJoin(itAssets, eq(itAssets.id, networkNodes.linkedAssetId))
    .where(eq(networkNodes.diagramVersionId, diagram.currentVersionId));

  const links = await db
    .select({ id: networkLinks.id, sourceNodeId: networkLinks.sourceNodeId, targetNodeId: networkLinks.targetNodeId, port: networkLinks.port, bandwidth: networkLinks.bandwidth, vlanNumber: networkVlans.vlanNumber })
    .from(networkLinks)
    .leftJoin(networkVlans, eq(networkVlans.id, networkLinks.vlanId))
    .where(eq(networkLinks.diagramVersionId, diagram.currentVersionId));

  return { diagram, nodes, links };
}

export async function listDiagramVersions(diagramId: string) {
  return db.select().from(diagramVersions).where(eq(diagramVersions.diagramId, diagramId)).orderBy(desc(diagramVersions.versionNo));
}
