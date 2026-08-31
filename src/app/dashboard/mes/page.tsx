import Link from 'next/link';
import { requireSession } from '@/lib/dal';
import { listMachines } from '@/lib/mes/machines';
import { listWorkCenters } from '@/lib/production/workcenters';
import { listDowntimeReasons, listOpenDowntimes } from '@/lib/mes/downtime';
import { CreateMachineForm, StartDowntimeForm, EndDowntimeButton } from '@/components/mes/mes-forms';

export default async function MesPage() {
  const session = await requireSession();
  const [machines, workCenters, reasons, openDowntimes] = await Promise.all([
    listMachines(session.companyId), listWorkCenters(session.companyId), listDowntimeReasons(), listOpenDowntimes(session.companyId)
  ]);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>MES (Üretim Yürütme Sistemi)</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>Makine/duruş/OEE — Faz 2'nin iş merkezi/üretim emri/iş emri altyapısının üzerine inşa edildi. Bir operasyonun OEE'sini görmek için ilgili Üretim Emri'nin detay sayfasına bakın.</p>

      {openDowntimes.length > 0 ? (
        <>
          <h2 style={{ fontSize: 15, marginBottom: 8, color: '#b00' }}>Açık Duruşlar ({openDowntimes.length})</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
            <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}><th style={{ padding: '6px 8px' }}>Makine</th><th style={{ padding: '6px 8px' }}>Neden</th><th style={{ padding: '6px 8px' }}>Başlangıç</th><th style={{ padding: '6px 8px' }}></th></tr></thead>
            <tbody>
              {openDowntimes.map((d) => (
                <tr key={d.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '6px 8px' }}>{d.machineName}</td>
                  <td style={{ padding: '6px 8px', color: '#666' }}>{d.reasonName}</td>
                  <td style={{ padding: '6px 8px', color: '#666' }}>{new Date(d.startedAt).toLocaleString('tr-TR')}</td>
                  <td style={{ padding: '6px 8px' }}><EndDowntimeButton downtimeId={d.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Duruş Başlat</h2>
      <div style={{ marginBottom: 24 }}><StartDowntimeForm machines={machines.map((m) => ({ id: m.id, code: m.code, name: m.name }))} reasons={reasons.map((r) => ({ code: r.code, name: r.name, category: r.category }))} /></div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Makineler</h2>
      {workCenters.length === 0 ? (
        <p style={{ color: '#b00', fontSize: 13, marginBottom: 20 }}>Önce Üretim → İş Merkezleri sayfasında en az bir iş merkezi tanımlanmalı.</p>
      ) : (
        <div style={{ marginBottom: 20 }}><CreateMachineForm workCenters={workCenters.map((w) => ({ id: w.id, code: w.code, name: w.name }))} /></div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '6px 8px' }}>Kod</th><th style={{ padding: '6px 8px' }}>Ad</th><th style={{ padding: '6px 8px' }}>İş Merkezi</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>İdeal Çevrim (sn)</th><th style={{ padding: '6px 8px' }}></th>
          </tr>
        </thead>
        <tbody>
          {machines.map((m) => (
            <tr key={m.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{m.code}</td>
              <td style={{ padding: '6px 8px' }}>{m.name}</td>
              <td style={{ padding: '6px 8px', color: '#666' }}>{m.workCenterName}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#666' }}>{m.idealCycleTimeSeconds ?? '—'}</td>
              <td style={{ padding: '6px 8px' }}><Link href={`/dashboard/mes/machines/${m.id}`}>OEE Paneli →</Link></td>
            </tr>
          ))}
          {machines.length === 0 ? <tr><td colSpan={5} style={{ padding: '8px', color: '#999' }}>Henüz makine yok.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
