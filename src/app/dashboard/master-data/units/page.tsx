import { requireFactoryAdmin } from '@/lib/dal';
import { listUnits } from '@/lib/master-data/units';
import { UnitForm } from '@/components/master-data/unit-form';

export default async function UnitsPage() {
  const session = await requireFactoryAdmin();
  const units = await listUnits(session.companyId);
  const unitById = new Map(units.map((u) => [u.id, u]));

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Birimler</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>Taban birim + dönüşüm çarpanı (madde 21) — ör. 1 KOLİ = 24 ADET.</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Kod</th>
            <th style={{ padding: '6px 8px' }}>Ad</th>
            <th style={{ padding: '6px 8px' }}>Dönüşüm</th>
          </tr>
        </thead>
        <tbody>
          {units.map((u) => (
            <tr key={u.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{u.code}</td>
              <td style={{ padding: '6px 8px' }}>{u.name}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{u.baseUnitId ? `1 ${u.code} = ${u.conversionFactor} ${unitById.get(u.baseUnitId)?.code ?? '?'}` : 'Taban birim'}</td>
            </tr>
          ))}
          {units.length === 0 ? <tr><td colSpan={3} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz birim yok.</td></tr> : null}
        </tbody>
      </table>

      <UnitForm units={units.map((u) => ({ id: u.id, code: u.code }))} />
    </div>
  );
}
