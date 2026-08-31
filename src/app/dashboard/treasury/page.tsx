import { requireSession } from '@/lib/dal';
import { getCashFlowForecast, listCashFlowItems } from '@/lib/treasury/cashflow';
import { getFxExposure } from '@/lib/treasury/fx';
import { listCollaterals } from '@/lib/legal/collaterals';
import { listCurrencies } from '@/lib/master-data/currency';
import { CreateCashFlowItemForm, MarkCashFlowItemRealizedButton, CancelCashFlowItemButton } from '@/components/treasury/treasury-forms';
import { CreateCollateralForm, ReleaseCollateralButton } from '@/components/legal/legal-forms';

const ITEM_STATUS_LABELS: Record<string, string> = { FORECAST: 'Tahmin', REALIZED: 'Gerçekleşti', CANCELLED: 'İptal' };
const COLLATERAL_TYPE_LABELS: Record<string, string> = { LETTER_OF_GUARANTEE: 'Teminat Mektubu', CASH_DEPOSIT: 'Nakit Teminat', CHECK: 'Çek', PROMISSORY_NOTE: 'Senet', OTHER: 'Diğer' };

function fmt(value: number): string {
  return value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function TreasuryPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { from, to } = await searchParams;
  const session = await requireSession();

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAhead = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const fromDate = from || today;
  const toDate = to || thirtyDaysAhead;

  const [forecast, items, fxExposure, collaterals, currencies] = await Promise.all([
    getCashFlowForecast(session.companyId, fromDate, toDate), listCashFlowItems(session.companyId), getFxExposure(session.companyId),
    listCollaterals(session.companyId), listCurrencies()
  ]);

  // Teminat, Faz 9'un legal_collaterals'ı — Hazine'nin genel (bir sözleşmeye
  // BAĞLI OLMAYAN) teminat kaydı için YENİ bir tablo AÇILMADI, contractId
  // BOŞ olan satırlar burada gösterilir (lib/legal/collaterals.ts DOĞRUDAN
  // yeniden kullanıldı, sıfır yeni kod).
  const generalCollaterals = collaterals.filter((c) => !c.contractId);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Hazine (Nakit Akış/Kur Riski/Teminat)</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Sözleşmeye bağlı teminatlar <a href="/dashboard/legal">Hukuk sayfasında</a>; burada yalnızca genel (banka kredi limiti vb.) teminatlar listelenir.</p>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Nakit Akış Tahmini</h2>
      <form method="get" style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16 }}>
        <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Başlangıç</label><input name="from" type="date" defaultValue={fromDate} style={{ padding: 6 }} /></div>
        <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Bitiş</label><input name="to" type="date" defaultValue={toDate} style={{ padding: 6 }} /></div>
        <button type="submit" style={{ padding: '7px 14px', cursor: 'pointer' }}>Uygula</button>
      </form>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <Stat label="Mevcut Nakit (Banka)" value={fmt(forecast.currentCash)} big />
        <Stat label="Beklenen Tahsilat" value={fmt(forecast.expectedInflows)} />
        <Stat label="Beklenen Ödeme" value={fmt(forecast.expectedOutflows)} />
        <Stat label="Projeksiyon Bakiye" value={fmt(forecast.projectedEndingCash)} big />
      </div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Manuel Nakit Akış Kalemi Ekle</h2>
      <p style={{ color: '#666', marginBottom: 8, fontSize: 12 }}>Çek/banka hareketi olmayan bilinen büyük tahsilat/ödeme beklentileri için.</p>
      <div style={{ marginBottom: 24 }}><CreateCashFlowItemForm currencies={currencies.map((c) => ({ code: c.code, name: c.name }))} /></div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Nakit Akış Kalemleri</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}><th style={{ padding: '6px 8px' }}>Yön</th><th style={{ padding: '6px 8px' }}>Açıklama</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Tutar</th><th style={{ padding: '6px 8px' }}>Tarih</th><th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}></th></tr></thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', color: i.direction === 'INFLOW' ? '#080' : '#b00' }}>{i.direction === 'INFLOW' ? 'Tahsilat' : 'Ödeme'}</td>
              <td style={{ padding: '6px 8px' }}>{i.description}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#666' }}>{i.amount} {i.currencyCode}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{i.expectedDate}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{ITEM_STATUS_LABELS[i.status]}</td>
              <td style={{ padding: '6px 8px' }}>
                {i.status === 'FORECAST' ? (<><MarkCashFlowItemRealizedButton itemId={i.id} /><CancelCashFlowItemButton itemId={i.id} /></>) : null}
              </td>
            </tr>
          ))}
          {items.length === 0 ? <tr><td colSpan={6} style={{ padding: '8px', color: '#999' }}>Henüz kalem yok.</td></tr> : null}
        </tbody>
      </table>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Kur Riski (Yabancı Para Banka Hesapları)</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Hesap</th><th style={{ padding: '6px 8px' }}>Para Birimi</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Bakiye</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Defter Değeri (₺)</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Güncel Değer (₺)</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Gerçekleşmemiş K/Z</th>
          </tr>
        </thead>
        <tbody>
          {fxExposure.map((f) => (
            <tr key={f.bankAccountId} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}>{f.name}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{f.currency}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#666' }}>{fmt(f.nativeBalance)}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#666' }}>{fmt(f.bookedTryValue)}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#666' }}>{f.currentTryValue === null ? '—' : fmt(f.currentTryValue)}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: f.unrealizedGainLoss === null ? '#999' : f.unrealizedGainLoss >= 0 ? '#080' : '#b00' }}>
                {f.unrealizedGainLoss === null ? 'Kur bulunamadı' : fmt(f.unrealizedGainLoss)}
              </td>
            </tr>
          ))}
          {fxExposure.length === 0 ? <tr><td colSpan={6} style={{ padding: '8px', color: '#999' }}>Yabancı para banka hesabı yok.</td></tr> : null}
        </tbody>
      </table>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Genel Teminat Ekle (Banka Kredi Limiti vb.)</h2>
      <div style={{ marginBottom: 24 }}><CreateCollateralForm contracts={[]} /></div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Genel Teminatlar</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}><th style={{ padding: '6px 8px' }}>Tip</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Tutar</th><th style={{ padding: '6px 8px' }}>Veren</th><th style={{ padding: '6px 8px' }}>Son Geçerlilik</th><th style={{ padding: '6px 8px' }}>Durum</th><th style={{ padding: '6px 8px' }}></th></tr></thead>
        <tbody>
          {generalCollaterals.map((c) => (
            <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}>{COLLATERAL_TYPE_LABELS[c.collateralType]}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#666' }}>{c.amount}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{c.provider || '—'}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{c.expiryDate ?? '—'}</td>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{c.status === 'ACTIVE' ? 'Aktif' : c.status === 'RELEASED' ? 'Serbest' : 'Süresi Doldu'}</td>
              <td style={{ padding: '6px 8px' }}>{c.status === 'ACTIVE' ? <ReleaseCollateralButton collateralId={c.id} /> : null}</td>
            </tr>
          ))}
          {generalCollaterals.length === 0 ? <tr><td colSpan={6} style={{ padding: '8px', color: '#999' }}>Henüz genel teminat yok.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: '10px 16px', minWidth: 130 }}>
      <div style={{ fontSize: big ? 24 : 18, fontWeight: 700 }}>₺{value}</div>
      <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
    </div>
  );
}
