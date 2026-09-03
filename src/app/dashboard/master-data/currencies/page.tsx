import { requireFactoryAdmin } from '@/lib/dal';
import { listCurrencies, listExchangeRates } from '@/lib/master-data/currency';
import { ExchangeRateForm } from '@/components/master-data/exchange-rate-form';

const RATE_TYPE_LABEL: Record<string, string> = { BUY: 'Alış', SELL: 'Satış', EFFECTIVE: 'Efektif', CENTRAL_BANK: 'Merkez Bankası', CUSTOM: 'Özel' };

export default async function CurrenciesPage() {
  await requireFactoryAdmin();
  const [currencies, rates] = await Promise.all([listCurrencies(), listExchangeRates()]);

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Para Birimleri</h1>
      <p style={{ color: 'var(--dim-on-surface-variant)', marginBottom: 20, fontSize: 13 }}>ISO 4217 kodları global referans verisi (şirkete özgü değil). Muhasebe hâlâ TRY-merkezli çalışıyor — bu, ileride Satınalma/Satış'ın döviz belgelerinde kullanacağı kur geçmişi.</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Kod</th>
            <th style={{ padding: '6px 8px' }}>Ad</th>
            <th style={{ padding: '6px 8px' }}>Sembol</th>
          </tr>
        </thead>
        <tbody>
          {currencies.map((c) => (
            <tr key={c.code} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{c.code}</td>
              <td style={{ padding: '6px 8px' }}>{c.name}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{c.symbol}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Kur Geçmişi</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--dim-border)' }}>
            <th style={{ padding: '6px 8px' }}>Tarih</th>
            <th style={{ padding: '6px 8px' }}>Para Birimi</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Kur</th>
            <th style={{ padding: '6px 8px' }}>Tür</th>
          </tr>
        </thead>
        <tbody>
          {rates.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid var(--dim-border-soft)' }}>
              <td style={{ padding: '6px 8px' }}>{r.rateDate}</td>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{r.currencyCode}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{Number(r.rate).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
              <td style={{ padding: '6px 8px', color: 'var(--dim-on-surface-variant)' }}>{RATE_TYPE_LABEL[r.rateType] ?? r.rateType}</td>
            </tr>
          ))}
          {rates.length === 0 ? <tr><td colSpan={4} style={{ padding: '8px', color: 'var(--dim-slate)' }}>Henüz kur kaydı yok.</td></tr> : null}
        </tbody>
      </table>

      <ExchangeRateForm currencies={currencies} />
    </div>
  );
}
