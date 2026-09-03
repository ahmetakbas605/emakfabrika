import { requireDepartmentAccess } from '@/lib/dal';
import { listParties } from '@/lib/master-data/parties';
import { listProducts } from '@/lib/master-data/products';
import { listAccounts } from '@/lib/accounting';
import { listShifts, listStores, listStoreSales } from '@/lib/marketing/stores';
import {
  CloseShiftForm,
  OpenShiftForm,
  StoreCreateForm,
  StoreSaleForm
} from '@/components/marketing/store-forms';

// Ofis / Mağaza — Pazarlama Faz 3.
//
// İki tür: "ikisi de olacak, tür mağaza bazında seçilir" (kullanıcının
// kararı). Sipariş alma noktası bu sayfada satış/vardiya GÖSTERMEZ —
// siparişleri mevcut Satış Süreci ekranlarından girilir, kopya bir akış
// açılmadı.

const STORE_TYPE_LABELS: Record<string, string> = {
  POS: 'Tezgâh Satışı',
  ORDER_INTAKE: 'Sipariş Alma Noktası'
};

function money(value: string | number | null): string {
  if (value == null) return '—';
  return Number(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(value: string | Date | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('tr-TR');
}

export default async function MarketingStoresPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, access } = await requireDepartmentAccess(departmentId);

  const [stores, shifts, parties, products, accounts] = await Promise.all([
    listStores(session.companyId, departmentId),
    listShifts(session.companyId),
    listParties(session.companyId),
    listProducts(session.companyId),
    listAccounts(session.companyId)
  ]);

  const shiftsByStore = new Map<string, typeof shifts>();
  for (const shift of shifts) {
    const list = shiftsByStore.get(shift.storeId) ?? [];
    list.push(shift);
    shiftsByStore.set(shift.storeId, list);
  }

  const salesByShift = new Map<string, Awaited<ReturnType<typeof listStoreSales>>>();
  const openShiftIds = shifts.filter((s) => s.status === 'OPEN').map((s) => s.id);
  await Promise.all(
    openShiftIds.map(async (shiftId) => {
      salesByShift.set(shiftId, await listStoreSales(session.companyId, shiftId));
    })
  );

  const canCreate = access.permissions.create;
  const canClose = access.permissions.post;

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Ofis / Mağaza</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>
        Tezgâh satışı yapan mağazalar kendi stoğunu ve kasasını tutar; gün sonunda tek bir kayıt olarak muhasebeye aktarılır.
        Sipariş alma noktaları yalnızca sipariş açar, satış/kasa akışına girmez.
      </p>

      {canCreate ? (
        <StoreCreateForm
          departmentId={departmentId}
          accountOptions={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name }))}
        />
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {stores.map((store) => {
          const storeShifts = shiftsByStore.get(store.id) ?? [];
          const openShift = storeShifts.find((s) => s.status === 'OPEN');
          const recentShifts = storeShifts.filter((s) => s.status === 'CLOSED').slice(0, 5);

          return (
            <div key={store.id} className="dim-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <div>
                  <span className="dim-metric" style={{ color: 'var(--dim-slate)' }}>{store.code}</span>
                  <h3 style={{ fontSize: 16, margin: '2px 0' }}>{store.name}</h3>
                  <span style={{ fontSize: 13, color: 'var(--dim-on-surface-variant)' }}>
                    {STORE_TYPE_LABELS[store.storeType] ?? store.storeType}
                    {store.location ? ` — ${store.location}` : ''}
                  </span>
                </div>
              </div>

              {store.storeType === 'ORDER_INTAKE' ? (
                <p style={{ fontSize: 13, color: 'var(--dim-slate)' }}>
                  Bu mağaza yalnızca sipariş alır. Sipariş girmek için Satış Süreci &gt; Siparişler ekranını kullanın.
                </p>
              ) : (
                <>
                  {!openShift ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 13, color: 'var(--dim-warning)' }}>Bugün için vardiya açılmadı.</span>
                      {canCreate ? <OpenShiftForm departmentId={departmentId} storeId={store.id} /> : null}
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                        <span style={{ fontSize: 13, color: 'var(--dim-success)' }}>
                          Vardiya açık — {formatDateTime(openShift.openedAt)}
                        </span>
                        {canClose ? <CloseShiftForm departmentId={departmentId} shiftId={openShift.id} /> : null}
                      </div>

                      <StoreSaleForm
                        storeId={store.id}
                        departmentId={departmentId}
                        partyOptions={parties.map((p) => ({ id: p.id, legalName: p.legalName }))}
                        productOptions={products.map((p) => ({ id: p.id, name: p.name }))}
                      />

                      <table style={{ marginTop: 12 }}>
                        <thead>
                          <tr><th>Fiş No</th><th>Müşteri</th><th>Tutar</th><th>Saat</th></tr>
                        </thead>
                        <tbody>
                          {(salesByShift.get(openShift.id) ?? []).map((sale) => (
                            <tr key={sale.id}>
                              <td>{sale.saleNo}</td>
                              <td>{sale.partyName ?? 'Gelip geçen müşteri'}</td>
                              <td>{money(sale.totalAmount)}</td>
                              <td>{formatDateTime(sale.createdAt)}</td>
                            </tr>
                          ))}
                          {(salesByShift.get(openShift.id) ?? []).length === 0 ? (
                            <tr><td colSpan={4} style={{ color: 'var(--dim-slate)' }}>Bu vardiyada henüz satış yok.</td></tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {recentShifts.length > 0 ? (
                    <div style={{ marginTop: 16 }}>
                      <span className="dim-metric" style={{ color: 'var(--dim-slate)' }}>Geçmiş Vardiyalar</span>
                      <table style={{ marginTop: 8 }}>
                        <thead>
                          <tr><th>Açılış</th><th>Kapanış</th><th>Toplam</th><th>Muhasebe Kaydı</th></tr>
                        </thead>
                        <tbody>
                          {recentShifts.map((s) => (
                            <tr key={s.id}>
                              <td>{formatDateTime(s.openedAt)}</td>
                              <td>{formatDateTime(s.closedAt)}</td>
                              <td>{money(s.totalAmount)}</td>
                              <td>{s.cashTransactionId ? <span style={{ color: 'var(--dim-success)' }}>Aktarıldı</span> : <span style={{ color: 'var(--dim-slate)' }}>—</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
        {stores.length === 0 ? (
          <p style={{ color: 'var(--dim-slate)', fontSize: 13 }}>Henüz mağaza tanımlanmadı.</p>
        ) : null}
      </div>
    </div>
  );
}
