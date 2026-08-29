import { requireDepartmentAccess } from '@/lib/dal';
import { getDiagramCurrentState, listDiagramVersions } from '@/lib/it/network-diagram';
import { listAssets } from '@/lib/it/assets';
import { NetworkDiagramCanvas } from '@/components/it/network-diagram-canvas';

export default async function NetworkDiagramEditorPage({ params }: { params: Promise<{ departmentId: string; diagramId: string }> }) {
  const { departmentId, diagramId } = await params;
  const { session } = await requireDepartmentAccess(departmentId);
  const [{ diagram, nodes, links }, versions, assets] = await Promise.all([
    getDiagramCurrentState(session.companyId, diagramId), listDiagramVersions(diagramId), listAssets(session.companyId)
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{diagram.name}</h1>
      <p style={{ color: '#666', marginBottom: 16, fontSize: 13 }}>{versions.length} versiyon — en son: v{versions[0]?.versionNo ?? '—'}</p>

      <NetworkDiagramCanvas
        departmentId={departmentId}
        diagramId={diagramId}
        initialNodes={nodes.map((n) => ({ id: n.id, nodeType: n.nodeType, linkedAssetId: n.linkedAssetId, assetTag: n.assetTag, label: n.label, positionX: n.positionX, positionY: n.positionY }))}
        initialLinks={links.map((l) => ({ id: l.id, sourceNodeId: l.sourceNodeId, targetNodeId: l.targetNodeId }))}
        assets={assets.map((a) => ({ id: a.id, assetTag: a.assetTag, name: a.name }))}
      />
    </div>
  );
}
