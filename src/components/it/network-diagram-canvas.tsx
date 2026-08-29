'use client';

import { useCallback, useState } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, addEdge, applyNodeChanges, applyEdgeChanges,
  type Node, type Edge, type Connection, type NodeChange, type EdgeChange
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { saveDiagramVersionAction } from '@/actions/it/network-diagram';

const NODE_TYPES = ['FIREWALL', 'ROUTER', 'SWITCH', 'SERVER', 'ACCESS_POINT', 'PRINTER', 'COMPUTER', 'CAMERA', 'NVR', 'INTERNET', 'CLOUD'] as const;
const NODE_TYPE_LABELS: Record<string, string> = {
  FIREWALL: 'Güvenlik Duvarı', ROUTER: 'Router', SWITCH: 'Switch', SERVER: 'Sunucu', ACCESS_POINT: 'Access Point',
  PRINTER: 'Yazıcı', COMPUTER: 'Bilgisayar', CAMERA: 'Kamera', NVR: 'NVR', INTERNET: 'İnternet', CLOUD: 'Bulut'
};

interface DiagramNode {
  id: string;
  nodeType: string;
  linkedAssetId: string | null;
  assetTag?: string | null;
  label: string;
  positionX: number;
  positionY: number;
}
interface DiagramLink {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
}

function toFlowNodes(nodes: DiagramNode[]): Node[] {
  return nodes.map((n) => ({
    id: n.id,
    position: { x: n.positionX, y: n.positionY },
    data: { label: `${NODE_TYPE_LABELS[n.nodeType] ?? n.nodeType}${n.assetTag ? ` — ${n.assetTag}` : n.label ? ` — ${n.label}` : ''}` },
    style: { border: '1px solid #666', borderRadius: 6, padding: 6, fontSize: 12, background: '#fff' }
  }));
}
function toFlowEdges(links: DiagramLink[]): Edge[] {
  return links.map((l) => ({ id: l.id, source: l.sourceNodeId, target: l.targetNodeId }));
}

export function NetworkDiagramCanvas({
  departmentId, diagramId, initialNodes, initialLinks, assets
}: {
  departmentId: string; diagramId: string; initialNodes: DiagramNode[]; initialLinks: DiagramLink[]; assets: { id: string; assetTag: string; name: string }[];
}) {
  const [nodes, setNodes] = useState<Node[]>(toFlowNodes(initialNodes));
  const [edges, setEdges] = useState<Edge[]>(toFlowEdges(initialLinks));
  const [nodeMeta, setNodeMeta] = useState<Map<string, { nodeType: string; linkedAssetId?: string; label: string }>>(
    new Map(initialNodes.map((n) => [n.id, { nodeType: n.nodeType, linkedAssetId: n.linkedAssetId ?? undefined, label: n.label }]))
  );
  const [newNodeType, setNewNodeType] = useState<string>('SERVER');
  const [newNodeAsset, setNewNodeAsset] = useState<string>('');
  const [newNodeLabel, setNewNodeLabel] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ error?: string; success?: string } | null>(null);

  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((connection: Connection) => setEdges((eds) => addEdge(connection, eds)), []);

  function addNode() {
    const id = crypto.randomUUID();
    const asset = assets.find((a) => a.id === newNodeAsset);
    const label = `${NODE_TYPE_LABELS[newNodeType]}${asset ? ` — ${asset.assetTag}` : newNodeLabel ? ` — ${newNodeLabel}` : ''}`;
    setNodes((nds) => [...nds, { id, position: { x: 80 + (nds.length % 6) * 140, y: 80 + Math.floor(nds.length / 6) * 100 }, data: { label }, style: { border: '1px solid #666', borderRadius: 6, padding: 6, fontSize: 12, background: '#fff' } }]);
    setNodeMeta((m) => new Map(m).set(id, { nodeType: newNodeType, linkedAssetId: newNodeAsset || undefined, label: newNodeLabel }));
    setNewNodeAsset('');
    setNewNodeLabel('');
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const payloadNodes = nodes.map((n) => {
      const meta = nodeMeta.get(n.id) ?? { nodeType: 'COMPUTER', label: '' };
      return { clientId: n.id, nodeType: meta.nodeType, linkedAssetId: meta.linkedAssetId, label: meta.label, positionX: n.position.x, positionY: n.position.y };
    });
    const payloadLinks = edges.map((e) => ({ sourceClientId: e.source, targetClientId: e.target }));
    const result = await saveDiagramVersionAction(departmentId, diagramId, { nodes: payloadNodes, links: payloadLinks });
    setMessage(result);
    setSaving(false);
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6, marginBottom: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Düğüm Tipi</label>
          <select value={newNodeType} onChange={(e) => setNewNodeType(e.target.value)} style={{ padding: 6 }}>
            {NODE_TYPES.map((t) => <option key={t} value={t}>{NODE_TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Varlık (opsiyonel)</label>
          <select value={newNodeAsset} onChange={(e) => setNewNodeAsset(e.target.value)} style={{ padding: 6, minWidth: 160 }}>
            <option value="">Seçilmedi</option>
            {assets.map((a) => <option key={a.id} value={a.id}>{a.assetTag} — {a.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Etiket (varlıksız düğümler için)</label>
          <input value={newNodeLabel} onChange={(e) => setNewNodeLabel(e.target.value)} placeholder="ör. İnternet Bağlantısı" style={{ padding: 6 }} />
        </div>
        <button type="button" onClick={addNode} style={{ padding: '7px 14px', cursor: 'pointer' }}>Düğüm Ekle</button>
        <button type="button" onClick={handleSave} disabled={saving} style={{ padding: '7px 14px', cursor: 'pointer', marginLeft: 'auto' }}>{saving ? 'Kaydediliyor...' : 'Diyagramı Kaydet (yeni versiyon)'}</button>
      </div>
      {message?.error ? <p style={{ color: '#b00', fontSize: 13, marginBottom: 8 }}>{message.error}</p> : null}
      {message?.success ? <p style={{ color: '#080', fontSize: 13, marginBottom: 8 }}>{message.success}</p> : null}
      <p style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>Düğümleri sürükleyerek yerleştirin, bir düğümün kenarından diğerine sürükleyerek bağlantı oluşturun. Bir bağlantıyı seçip Delete tuşuna basarak silebilirsiniz.</p>

      <div style={{ height: 500, border: '1px solid #ddd', borderRadius: 6 }}>
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} fitView deleteKeyCode={['Backspace', 'Delete']}>
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}
