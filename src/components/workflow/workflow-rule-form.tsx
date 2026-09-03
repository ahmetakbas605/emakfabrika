'use client';

import { useActionState, useState } from 'react';
import { createWorkflowRuleAction, type FormState } from '@/actions/workflow';

interface ChainStep {
  approverType: 'POSITION' | 'SPECIFIC_USER' | 'MANAGER_CHAIN';
  approverValue: string;
  mode: 'SEQUENTIAL' | 'PARALLEL';
  quorum: string;
}

const EMPTY_STEP: ChainStep = { approverType: 'POSITION', approverValue: '', mode: 'SEQUENTIAL', quorum: '' };

export function WorkflowRuleForm({ positions, users }: { positions: { id: string; title: string }[]; users: { id: string; fullName: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createWorkflowRuleAction, undefined);
  const [chain, setChain] = useState<ChainStep[]>([{ ...EMPTY_STEP }]);

  function updateStep(index: number, patch: Partial<ChainStep>) {
    setChain((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }
  function addStep() {
    setChain((prev) => [...prev, { ...EMPTY_STEP }]);
  }
  function removeStep(index: number) {
    setChain((prev) => prev.filter((_, i) => i !== index));
  }

  const chainJson = JSON.stringify(
    chain
      .filter((s) => s.approverValue)
      .map((s) => ({ approverType: s.approverType, approverValue: s.approverValue, mode: s.mode, quorum: s.quorum ? Number(s.quorum) : undefined }))
  );

  return (
    <form action={formAction} style={{ border: '1px solid var(--dim-border-soft)', padding: 16, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input type="hidden" name="chainJson" value={chainJson} />
      <h3 style={{ fontSize: 14, margin: 0 }}>Yeni Onay Kuralı</h3>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Belge Türü</label>
          <input name="documentType" required style={{ padding: 6, width: 220 }} placeholder="PROCUREMENT_REQUISITION" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Kural Adı</label>
          <input name="name" required style={{ padding: 6, width: 220 }} placeholder="Düşük tutar" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Öncelik</label>
          <input name="priority" type="number" style={{ padding: 6, width: 80 }} placeholder="0" />
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)', marginBottom: 4 }}>Koşullar (boş = her zaman eşleşir)</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input name="minAmount" placeholder="Min tutar" style={{ padding: 6, width: 110 }} />
          <input name="maxAmount" placeholder="Maks tutar" style={{ padding: 6, width: 110 }} />
          <input name="categoryCode" placeholder="Kategori kodu" style={{ padding: 6, width: 140 }} />
          <select name="capexOpex" style={{ padding: 6 }}>
            <option value="">CAPEX/OPEX — farketmez</option>
            <option value="CAPEX">CAPEX</option>
            <option value="OPEX">OPEX</option>
          </select>
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)', marginBottom: 4 }}>Onay Zinciri (sırayla)</label>
        {chain.map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--dim-slate)', width: 18 }}>{i + 1}.</span>
            <select value={step.approverType} onChange={(e) => updateStep(i, { approverType: e.target.value as ChainStep['approverType'], approverValue: '' })} style={{ padding: 6 }}>
              <option value="POSITION">Pozisyon</option>
              <option value="SPECIFIC_USER">Belirli Kullanıcı</option>
              <option value="MANAGER_CHAIN">Yönetici Zinciri (N. seviye)</option>
            </select>
            {step.approverType === 'POSITION' ? (
              <select value={step.approverValue} onChange={(e) => updateStep(i, { approverValue: e.target.value })} style={{ padding: 6, minWidth: 160 }}>
                <option value="">Pozisyon seçin</option>
                {positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            ) : step.approverType === 'SPECIFIC_USER' ? (
              <select value={step.approverValue} onChange={(e) => updateStep(i, { approverValue: e.target.value })} style={{ padding: 6, minWidth: 160 }}>
                <option value="">Kullanıcı seçin</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
              </select>
            ) : (
              <input value={step.approverValue} onChange={(e) => updateStep(i, { approverValue: e.target.value })} placeholder="1 = doğrudan yönetici" style={{ padding: 6, width: 160 }} />
            )}
            <select value={step.mode} onChange={(e) => updateStep(i, { mode: e.target.value as ChainStep['mode'] })} style={{ padding: 6 }}>
              <option value="SEQUENTIAL">Hepsi gerekli</option>
              <option value="PARALLEL">Quorum yeterli</option>
            </select>
            {step.mode === 'PARALLEL' ? <input value={step.quorum} onChange={(e) => updateStep(i, { quorum: e.target.value })} placeholder="Quorum" style={{ padding: 6, width: 80 }} /> : null}
            {chain.length > 1 ? <button type="button" onClick={() => removeStep(i)} style={{ cursor: 'pointer' }}>Kaldır</button> : null}
          </div>
        ))}
        <button type="button" onClick={addStep} style={{ cursor: 'pointer', fontSize: 13 }}>+ Adım Ekle</button>
      </div>

      <div>
        <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? 'Oluşturuluyor...' : 'Kural Oluştur'}</button>
        {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12, marginLeft: 10 }}>{state.error}</span> : null}
        {state?.success ? <span style={{ color: 'var(--dim-success)', fontSize: 12, marginLeft: 10 }}>{state.success}</span> : null}
      </div>
    </form>
  );
}
