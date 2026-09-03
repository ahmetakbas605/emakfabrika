'use client';

import { useActionState } from 'react';
import {
  createContractAction, updateContractStatusAction, createLawsuitAction, updateLawsuitStatusAction,
  createCollateralAction, releaseCollateralAction, createRiskAction, updateRiskAssessmentAction, startRiskMitigationAction, closeRiskAction, type FormState
} from '@/actions/legal';

export function CreateContractForm({ parties, users }: { parties: { id: string; legalName: string }[]; users: { id: string; fullName: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createContractAction, undefined);
  return (
    <form action={formAction} encType="multipart/form-data" style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Başlık</label><input name="title" required style={{ padding: 6, width: 180 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Tip</label>
        <select name="contractType" required style={{ padding: 6 }}>
          <option value="SUPPLIER">Tedarikçi</option>
          <option value="CUSTOMER">Müşteri</option>
          <option value="LEASE">Kira</option>
          <option value="NDA">Gizlilik (NDA)</option>
          <option value="SERVICE">Hizmet</option>
          <option value="OTHER">Diğer</option>
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Karşı Taraf (Cari, ops.)</label>
        <select name="counterpartyPartyId" style={{ padding: 6, minWidth: 140 }}>
          <option value="">Yok</option>
          {parties.map((p) => <option key={p.id} value={p.id}>{p.legalName}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Karşı Taraf Adı (ops.)</label><input name="counterpartyName" style={{ padding: 6, width: 140 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Başlangıç (ops.)</label><input name="startDate" type="date" style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Bitiş (ops.)</label><input name="endDate" type="date" style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Değer (ops.)</label><input name="value" type="number" step="0.01" style={{ padding: 6, width: 90 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Sorumlu (ops.)</label>
        <select name="ownerUserId" style={{ padding: 6, minWidth: 140 }}>
          <option value="">Seçin</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Belge (ops.)</label><input name="file" type="file" style={{ padding: 6 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Sözleşme Oluştur'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function UpdateContractStatusForm({ contractId }: { contractId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateContractStatusAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <input type="hidden" name="contractId" value={contractId} />
      <select name="status" style={{ padding: 4, fontSize: 12 }}>
        <option value="DRAFT">Taslak</option>
        <option value="ACTIVE">Aktif</option>
        <option value="EXPIRED">Süresi Doldu</option>
        <option value="TERMINATED">Feshedildi</option>
      </select>
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Güncelle'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11 }}>{state.error}</span> : null}
    </form>
  );
}

export function CreateLawsuitForm({ contracts, parties, users }: { contracts: { id: string; contractNo: string; title: string }[]; parties: { id: string; legalName: string }[]; users: { id: string; fullName: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createLawsuitAction, undefined);
  return (
    <form action={formAction} encType="multipart/form-data" style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Başlık</label><input name="title" required style={{ padding: 6, width: 180 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Şirketin Rolü</label>
        <select name="companyRole" required style={{ padding: 6 }}>
          <option value="PLAINTIFF">Davacı</option>
          <option value="DEFENDANT">Davalı</option>
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>İlgili Sözleşme (ops.)</label>
        <select name="contractId" style={{ padding: 6, minWidth: 140 }}>
          <option value="">Yok</option>
          {contracts.map((c) => <option key={c.id} value={c.id}>{c.contractNo} — {c.title}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Karşı Taraf (Cari, ops.)</label>
        <select name="counterpartyPartyId" style={{ padding: 6, minWidth: 140 }}>
          <option value="">Yok</option>
          {parties.map((p) => <option key={p.id} value={p.id}>{p.legalName}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Karşı Taraf Adı (ops.)</label><input name="counterpartyName" style={{ padding: 6, width: 140 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Dava Değeri (ops.)</label><input name="claimAmount" type="number" step="0.01" style={{ padding: 6, width: 100 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Mahkeme (ops.)</label><input name="courtName" style={{ padding: 6, width: 140 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Açılış Tarihi (ops.)</label><input name="filedDate" type="date" style={{ padding: 6 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Sorumlu (ops.)</label>
        <select name="ownerUserId" style={{ padding: 6, minWidth: 140 }}>
          <option value="">Seçin</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Belge (ops.)</label><input name="file" type="file" style={{ padding: 6 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Dava Kaydı Oluştur'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function UpdateLawsuitStatusForm({ lawsuitId }: { lawsuitId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateLawsuitStatusAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <input type="hidden" name="lawsuitId" value={lawsuitId} />
      <select name="status" style={{ padding: 4, fontSize: 12 }}>
        <option value="OPEN">Açık</option>
        <option value="IN_PROGRESS">Devam Ediyor</option>
        <option value="SETTLED">Uzlaşıldı</option>
        <option value="WON">Kazanıldı</option>
        <option value="LOST">Kaybedildi</option>
        <option value="CLOSED">Kapatıldı</option>
      </select>
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Güncelle'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11 }}>{state.error}</span> : null}
    </form>
  );
}

export function CreateCollateralForm({ contracts }: { contracts: { id: string; contractNo: string; title: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createCollateralAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Sözleşme (ops.)</label>
        <select name="contractId" style={{ padding: 6, minWidth: 140 }}>
          <option value="">Yok</option>
          {contracts.map((c) => <option key={c.id} value={c.id}>{c.contractNo} — {c.title}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Tip</label>
        <select name="collateralType" required style={{ padding: 6 }}>
          <option value="LETTER_OF_GUARANTEE">Teminat Mektubu</option>
          <option value="CASH_DEPOSIT">Nakit Teminat</option>
          <option value="CHECK">Çek</option>
          <option value="PROMISSORY_NOTE">Senet</option>
          <option value="OTHER">Diğer</option>
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Tutar</label><input name="amount" type="number" step="0.01" required style={{ padding: 6, width: 100 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Veren Kurum (ops.)</label><input name="provider" style={{ padding: 6, width: 140 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Düzenleme (ops.)</label><input name="issueDate" type="date" style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Son Geçerlilik (ops.)</label><input name="expiryDate" type="date" style={{ padding: 6 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Teminat Ekle'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function ReleaseCollateralButton({ collateralId }: { collateralId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(releaseCollateralAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block' }}>
      <input type="hidden" name="collateralId" value={collateralId} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Serbest Bırak'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11, marginLeft: 4 }}>{state.error}</span> : null}
    </form>
  );
}

export function CreateRiskForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createRiskAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid var(--dim-border-soft)', padding: 12, borderRadius: 6 }}>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Başlık</label><input name="title" required style={{ padding: 6, width: 180 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Kategori</label>
        <select name="category" required style={{ padding: 6 }}>
          <option value="LEGAL">Hukuki</option>
          <option value="FINANCIAL">Mali</option>
          <option value="OPERATIONAL">Operasyonel</option>
          <option value="STRATEGIC">Stratejik</option>
          <option value="COMPLIANCE">Uyum</option>
          <option value="OTHER">Diğer</option>
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Olasılık (1-5)</label><input name="probability" type="number" min="1" max="5" required style={{ padding: 6, width: 60 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Etki (1-5)</label><input name="impact" type="number" min="1" max="5" required style={{ padding: 6, width: 60 }} /></div>
      <div style={{ width: '100%' }}><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Açıklama (ops.)</label><input name="description" style={{ padding: 6, width: '100%' }} /></div>
      <div style={{ width: '100%' }}><label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Önleyici Faaliyet (ops.)</label><input name="mitigation" style={{ padding: 6, width: '100%' }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Risk Kaydı Oluştur'}</button>
      {state?.error ? <p style={{ color: 'var(--dim-danger)', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: 'var(--dim-success)', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function UpdateRiskAssessmentForm({ riskId, probability, impact, mitigation }: { riskId: string; probability: number; impact: number; mitigation: string | null }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateRiskAssessmentAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="hidden" name="riskId" value={riskId} />
      <input name="probability" type="number" min="1" max="5" defaultValue={probability} style={{ padding: 4, width: 50, fontSize: 12 }} />
      <input name="impact" type="number" min="1" max="5" defaultValue={impact} style={{ padding: 4, width: 50, fontSize: 12 }} />
      <input name="mitigation" defaultValue={mitigation ?? ''} placeholder="Önleyici faaliyet" style={{ padding: 4, fontSize: 12, width: 160 }} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Değerlendirmeyi Güncelle'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11 }}>{state.error}</span> : null}
    </form>
  );
}

export function StartRiskMitigationButton({ riskId }: { riskId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(startRiskMitigationAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block' }}>
      <input type="hidden" name="riskId" value={riskId} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Azaltmaya Başla'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11, marginLeft: 4 }}>{state.error}</span> : null}
    </form>
  );
}

export function CloseRiskButton({ riskId }: { riskId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(closeRiskAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block', marginLeft: 4 }}>
      <input type="hidden" name="riskId" value={riskId} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Kapat'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11, marginLeft: 4 }}>{state.error}</span> : null}
    </form>
  );
}
