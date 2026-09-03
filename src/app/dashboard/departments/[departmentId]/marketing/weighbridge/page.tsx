import { requireDepartmentAccess } from '@/lib/dal';
import { listParties } from '@/lib/master-data/parties';
import { listProducts } from '@/lib/master-data/products';
import {
  listOrderFulfilment,
  listWeighbridges,
  listWeighbridgeTickets
} from '@/lib/marketing/weighbridge';
import {
  TicketCancelForm,
  TicketReverseForm,
  WeighbridgeForm,
  WeighbridgeTicketForm
} from '@/components/marketing/weighbridge-forms';

// Kantar — Pazarlama Faz 2.
//
// Üç bölüm, kullanıcının tarifine birebir:
//  1. "talep / şu anki / eksik" — sipariş satırı bazında gerçekleşme.
//  2. Tartım fişleri — kg'lı üründe miktar, adetli üründe tonaj kontrolü.
//  3. Kantar tanımları — "bir veya birden çok kantar".

const PURPOSE_LABELS: Record<string, string> = {
  SALES_QUANTITY: 'Satış Miktarı',
  ROAD_LEGAL_CHECK: 'Tonaj Kontrolü'
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Taslak',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal',
  REVERSED: 'Ters Kayıt'
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'var(--dim-warning)',
  COMPLETED: 'var(--dim-success)',
  CANCELLED: 'var(--dim-slate)',
  REVERSED: 'var(--dim-danger)'
};

function kg(value: string | number | null): string {
  if (value == null) return '—';
  return `${Number(value).toLocaleString('tr-TR', { maximumFractionDigits: 3 })} kg`;
}

export default async function WeighbridgePage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);

  const bridges = await listWeighbridges(session.companyId, departmentId);
  // Tolerans kantar tanımından gelir; birden çok kantarda en yükseği
  // referans alınır (kullanıcı: "ileride belli bir tolerans tanımlanabilir",
  // varsayılan 0 = kapalı).
  const tolerance = bridges.reduce((max, b) => Math.max(max, Number(b.tolerancePercent ?? 0)), 0);

  const [tickets, fulfilment, parties, products] = await Promise.all([
    listWeighbridgeTickets(session.companyId),
    listOrderFulfilment(session.companyId, tolerance),
    listParties(session.companyId),
    listProducts(session.companyId)
  ]);

  const orderLineOptions = fulfilment.map((f) => ({
    id: f.orderLineId,
    label: `${f.orderNo} — ${f.productName} (${f.partyName})`
  }));

  const canCancel = access.permissions.cancel;
  const canCorrect = access.permissions.correct_weighing;

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Kantar</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>
        Kilogramla satılan ürünlerde net ağırlık faturaya giden miktarı belirler. Adetli ürünlerde tartım miktarı değiştirmez,
        yalnızca aracın karayolları tonaj sınırını aşıp aşmadığını belgeler.
      </p>

      {/* --- 1. Talep / Şu anki / Eksik --- */}
      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Sipariş Gerçekleşme (Talep / Şu Anki / Eksik)</h2>
      <table style={{ marginBottom: 28 }}>
        <thead>
          <tr>
            <th>Sipariş</th><th>Cari</th><th>Ürün</th><th>Talep</th>
            <th>Talep (kg)</th><th>Şu Anki (kg)</th><th>Eksik (kg)</th><th>Durum</th>
          </tr>
        </thead>
        <tbody>
          {fulfilment.map((f) => {
            const over = f.remainingKg != null && f.remainingKg < 0;
            return (
              <tr key={f.orderLineId}>
                <td>{f.orderNo}</td>
                <td>{f.partyName}</td>
                <td>{f.productName}</td>
                <td>{Number(f.requestedQty).toLocaleString('tr-TR')} {f.productUnitCode}</td>
                <td>{f.requestedKg != null ? kg(f.requestedKg) : <span style={{ color: 'var(--dim-warning)' }}>birim çevrimi yok</span>}</td>
                <td>{kg(f.deliveredKg)}</td>
                <td style={{ color: over ? 'var(--dim-warning)' : 'var(--dim-bone)' }}>
                  {f.remainingKg != null ? (over ? `+${kg(Math.abs(f.remainingKg))} fazla` : kg(f.remainingKg)) : '—'}
                </td>
                <td>
                  {f.withinTolerance === null ? (
                    <span style={{ color: 'var(--dim-slate)' }}>—</span>
                  ) : f.withinTolerance ? (
                    <span style={{ color: 'var(--dim-success)' }}>Tolerans içinde</span>
                  ) : (
                    <span style={{ color: 'var(--dim-danger)' }}>Tolerans dışı</span>
                  )}
                </td>
              </tr>
            );
          })}
          {fulfilment.length === 0 ? (
            <tr><td colSpan={8} style={{ color: 'var(--dim-slate)' }}>Açık sipariş yok.</td></tr>
          ) : null}
        </tbody>
      </table>

      {/* --- 2. Tartım fişleri --- */}
      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Tartım Fişi Kes</h2>
      {bridges.length === 0 ? (
        <p className="dim-card" style={{ padding: 16, color: 'var(--dim-warning)', fontSize: 13, marginBottom: 20 }}>
          Önce aşağıdan en az bir kantar tanımlayın.
        </p>
      ) : (
        <WeighbridgeTicketForm
          departmentId={departmentId}
          weighbridgeOptions={bridges.map((b) => ({ id: b.id, name: b.name }))}
          partyOptions={parties.map((p) => ({ id: p.id, legalName: p.legalName }))}
          productOptions={products.map((p) => ({ id: p.id, name: p.name }))}
          orderLineOptions={orderLineOptions}
        />
      )}

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Tartım Fişleri</h2>
      <table style={{ marginBottom: 28 }}>
        <thead>
          <tr>
            <th>Fiş No</th><th>Kantar</th><th>Amaç</th><th>Plaka</th><th>Cari / Ürün</th>
            <th>Brüt</th><th>Dara</th><th>Net</th><th>Tonaj</th><th>Durum</th><th>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => (
            <tr key={t.id}>
              <td>{t.ticketNo}</td>
              <td>{t.weighbridgeName}</td>
              <td>{PURPOSE_LABELS[t.purpose] ?? t.purpose}</td>
              <td>{t.plateNo}</td>
              <td>{[t.partyName, t.productName].filter(Boolean).join(' / ') || '—'}</td>
              <td>{kg(t.grossKg)}</td>
              <td>{kg(t.tareKg)}</td>
              <td>{kg(t.netKg)}</td>
              <td>
                {t.roadLegalOk === null ? (
                  <span style={{ color: 'var(--dim-slate)' }}>—</span>
                ) : t.roadLegalOk ? (
                  <span style={{ color: 'var(--dim-success)' }}>Uygun</span>
                ) : (
                  <span style={{ color: 'var(--dim-danger)' }}>AŞIM</span>
                )}
              </td>
              <td style={{ color: STATUS_COLORS[t.status] }}>{STATUS_LABELS[t.status] ?? t.status}</td>
              <td>
                {t.status === 'COMPLETED' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {canCancel ? <TicketCancelForm departmentId={departmentId} ticketId={t.id} /> : null}
                    {canCorrect ? <TicketReverseForm departmentId={departmentId} ticketId={t.id} /> : null}
                    {!canCancel && !canCorrect ? <span style={{ color: 'var(--dim-slate)', fontSize: 11 }}>yetki yok</span> : null}
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
          {tickets.length === 0 ? (
            <tr><td colSpan={11} style={{ color: 'var(--dim-slate)' }}>Henüz tartım fişi yok.</td></tr>
          ) : null}
        </tbody>
      </table>

      {/* --- 3. Kantar tanımları --- */}
      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Kantar Tanımları</h2>
      <WeighbridgeForm departmentId={departmentId} />
      <table>
        <thead>
          <tr><th>Kod</th><th>Ad</th><th>Konum</th><th>Kapasite</th><th>Karayolu Limiti</th><th>Tolerans</th></tr>
        </thead>
        <tbody>
          {bridges.map((b) => (
            <tr key={b.id}>
              <td>{b.code}</td>
              <td>{b.name}</td>
              <td>{b.location || '—'}</td>
              <td>{kg(b.capacityKg)}</td>
              <td>{kg(b.roadLegalLimitKg)}</td>
              <td>{Number(b.tolerancePercent ?? 0) === 0 ? 'kapalı' : `%${b.tolerancePercent}`}</td>
            </tr>
          ))}
          {bridges.length === 0 ? (
            <tr><td colSpan={6} style={{ color: 'var(--dim-slate)' }}>Henüz kantar tanımlanmadı.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
