'use client';

import { useActionState, useState } from 'react';
import { createTenderAction, publishTenderAction, cancelTenderAction, type FormState } from '@/actions/procurement-tender';

interface ManualLine { description: string; quantity: string; unitId: string }

export function TenderCreateForm({ units, suppliers }: { units: { id: string; code: string }[]; suppliers: { id: string; legalName: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createTenderAction, undefined);
  const [lines, setLines] = useState<ManualLine[]>([{ description: '', quantity: '', unitId: units[0]?.id ?? '' }]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
  const [openParticipation, setOpenParticipation] = useState(false);
  const [bidBondRequired, setBidBondRequired] = useState(false);

  function addLine() {
    setLines((prev) => [...prev, { description: '', quantity: '', unitId: units[0]?.id ?? '' }]);
  }
  function updateLine(i: number, patch: Partial<ManualLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }
  function toggleSupplier(id: string) {
    setSelectedSuppliers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const linesJson = JSON.stringify(lines.filter((l) => l.description && l.quantity && l.unitId));
  const supplierPartyIdsJson = JSON.stringify([...selectedSuppliers]);

  return (
    <form action={formAction} style={{ border: '1px solid var(--dim-border-soft)', padding: 16, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input type="hidden" name="linesJson" value={linesJson} />
      <input type="hidden" name="supplierPartyIdsJson" value={supplierPartyIdsJson} />
      <h3 style={{ fontSize: 14, margin: 0 }}>Yeni İhale</h3>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Başlık</label>
          <input name="title" required style={{ padding: 6, width: 220 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Teklif Son Tarihi</label>
          <input name="bidSubmissionDeadline" type="datetime-local" style={{ padding: 6 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Açılış Anı</label>
          <input name="bidOpeningAt" type="datetime-local" style={{ padding: 6 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Teslimat Yeri</label>
          <input name="deliveryLocation" style={{ padding: 6, width: 140 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)' }}>Ödeme Koşulu</label>
          <input name="paymentTerms" style={{ padding: 6, width: 140 }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }}>
          <input type="checkbox" name="bidBondRequired" checked={bidBondRequired} onChange={(e) => setBidBondRequired(e.target.checked)} /> Teminat Gerekli
        </label>
        {bidBondRequired ? (
          <>
            <input name="bidBondPercent" placeholder="Teminat %" style={{ padding: 5, width: 90 }} />
            <input name="bidBondAmount" placeholder="Teminat Tutarı" style={{ padding: 5, width: 120 }} />
          </>
        ) : null}
        <label style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }}>
          <input type="checkbox" name="openParticipation" checked={openParticipation} onChange={(e) => setOpenParticipation(e.target.checked)} /> Açık Katılım (davetsiz tedarikçi teklif verebilir)
        </label>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)', marginBottom: 4 }}>Kalemler</label>
        {lines.map((line, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
            <input value={line.description} onChange={(e) => updateLine(i, { description: e.target.value })} placeholder="Açıklama" style={{ padding: 5, flex: 1 }} />
            <input value={line.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} placeholder="Miktar" style={{ padding: 5, width: 90 }} />
            <select value={line.unitId} onChange={(e) => updateLine(i, { unitId: e.target.value })} style={{ padding: 5 }}>
              {units.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}
            </select>
            <button type="button" onClick={() => removeLine(i)} style={{ cursor: 'pointer' }}>Kaldır</button>
          </div>
        ))}
        <button type="button" onClick={addLine} style={{ cursor: 'pointer', fontSize: 13 }}>+ Kalem Ekle</button>
      </div>

      {!openParticipation ? (
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--dim-on-surface-variant)', marginBottom: 4 }}>Davet Edilecek Tedarikçiler</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {suppliers.map((s) => (
              <label key={s.id} style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }}>
                <input type="checkbox" checked={selectedSuppliers.has(s.id)} onChange={() => toggleSupplier(s.id)} />
                {s.legalName}
              </label>
            ))}
            {suppliers.length === 0 ? <span style={{ fontSize: 12, color: 'var(--dim-danger)' }}>Önce Master Data → Cariler&apos;de tedarikçi rolüyle bir cari kartı oluşturun.</span> : null}
          </div>
        </div>
      ) : null}

      <div>
        <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? 'Oluşturuluyor...' : 'İhale Oluştur'}</button>
        {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12, marginLeft: 10 }}>{state.error}</span> : null}
        {state?.success ? <span style={{ color: 'var(--dim-success)', fontSize: 12, marginLeft: 10 }}>{state.success}</span> : null}
      </div>
    </form>
  );
}

export function PublishTenderButton({ tenderId }: { tenderId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(publishTenderAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <input type="hidden" name="tenderId" value={tenderId} />
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Yayınla'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12 }}>{state.error}</span> : null}
    </form>
  );
}

export function CancelTenderButton({ tenderId }: { tenderId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(cancelTenderAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <input type="hidden" name="tenderId" value={tenderId} />
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'İptal Et'}</button>
      {state?.error ? <span style={{ color: 'var(--dim-danger)', fontSize: 12 }}>{state.error}</span> : null}
    </form>
  );
}
