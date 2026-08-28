'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { postJournalAction, type FormState } from '@/actions/accounting';
import type { JournalLineInput } from '@/lib/accounting';

interface Row {
  accountCode: string;
  debit: string;
  credit: string;
}

const EMPTY_ROW: Row = { accountCode: '', debit: '', credit: '' };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function JournalForm({ departmentId, accounts }: { departmentId: string; accounts: { code: string; name: string }[] }) {
  const router = useRouter();
  const action = postJournalAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const [rows, setRows] = useState<Row[]>([{ ...EMPTY_ROW }, { ...EMPTY_ROW }]);

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, { ...EMPTY_ROW }]);
  }
  function removeRow(i: number) {
    setRows((prev) => (prev.length > 2 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  const totalDebit = rows.reduce((s, r) => s + (parseFloat(r.debit.replace(',', '.')) || 0), 0);
  const totalCredit = rows.reduce((s, r) => s + (parseFloat(r.credit.replace(',', '.')) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0;

  const lines: JournalLineInput[] = rows
    .filter((r) => r.accountCode.trim() && (parseFloat(r.debit) > 0 || parseFloat(r.credit) > 0))
    .map((r) => ({ accountCode: r.accountCode.trim(), debit: parseFloat(r.debit.replace(',', '.')) || 0, credit: parseFloat(r.credit.replace(',', '.')) || 0 }));

  if (state?.success && !pending) {
    // Server action başarıyla kaydettikten sonra listeye dön.
    router.push(`/dashboard/departments/${departmentId}/journals`);
  }

  return (
    <form action={formAction} style={{ maxWidth: 720 }}>
      <input type="hidden" name="linesJson" value={JSON.stringify(lines)} />

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tarih</label>
          <input name="journalDate" type="date" defaultValue={todayIso()} required style={{ padding: 6 }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Açıklama</label>
          <input name="description" style={{ padding: 6, width: '100%' }} placeholder="Opsiyonel" />
        </div>
      </div>

      <datalist id="account-codes">
        {accounts.map((a) => (
          <option key={a.code} value={a.code}>{a.name}</option>
        ))}
      </datalist>

      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
          <input list="account-codes" value={row.accountCode} onChange={(e) => updateRow(i, { accountCode: e.target.value })} placeholder="Hesap kodu" style={{ padding: 6, width: 140 }} />
          <input value={row.debit} onChange={(e) => updateRow(i, { debit: e.target.value, credit: '' })} placeholder="Borç" type="number" step="any" min={0} style={{ padding: 6, width: 130 }} />
          <input value={row.credit} onChange={(e) => updateRow(i, { credit: e.target.value, debit: '' })} placeholder="Alacak" type="number" step="any" min={0} style={{ padding: 6, width: 130 }} />
          <button type="button" onClick={() => removeRow(i)} style={{ padding: '4px 8px', cursor: 'pointer' }}>Sil</button>
        </div>
      ))}
      <button type="button" onClick={addRow} style={{ padding: '6px 12px', marginTop: 4, cursor: 'pointer' }}>+ Kalem Ekle</button>

      <div style={{ marginTop: 16, borderTop: '1px solid #ddd', paddingTop: 10, fontSize: 13 }}>
        <span>Toplam Borç: <strong>{totalDebit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</strong></span>
        <span style={{ marginLeft: 20 }}>Toplam Alacak: <strong>{totalCredit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</strong></span>
        {!balanced ? <span style={{ marginLeft: 20, color: '#b00' }}>Dengesiz — kaydedilemez</span> : <span style={{ marginLeft: 20, color: '#080' }}>Dengeli</span>}
      </div>

      <button type="submit" disabled={pending || !balanced} style={{ padding: '9px 18px', marginTop: 14, cursor: 'pointer' }}>
        {pending ? 'Kaydediliyor...' : 'Fişi Kaydet'}
      </button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, marginTop: 8 }}>{state.error}</p> : null}
    </form>
  );
}
