'use client';

import { useActionState } from 'react';
import { getTicketAiAssistanceAction, type AiFormState } from '@/actions/it/ai-assistant';

export function TicketAiAssistant({ departmentId, ticketId }: { departmentId: string; ticketId: string }) {
  const action = getTicketAiAssistanceAction.bind(null, departmentId, ticketId);
  const [state, formAction, pending] = useActionState<AiFormState, FormData>(action, undefined);

  return (
    <div style={{ border: '1px solid #ddd', padding: 12, borderRadius: 6, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: state ? 10 : 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>AI Asistan</span>
        <form action={formAction}>
          <button type="submit" disabled={pending} style={{ padding: '6px 12px', cursor: 'pointer' }}>{pending ? '...' : 'Analiz Et'}</button>
        </form>
      </div>

      {state?.error ? <span style={{ color: '#b00', fontSize: 12 }}>{state.error}</span> : null}

      {state?.result && !state.result.configured ? (
        <p style={{ color: '#999', fontSize: 12 }}>AI asistanı yapılandırılmamış (GROQ_API_KEY veya ANTHROPIC_API_KEY .env&apos;de tanımlı değil).</p>
      ) : null}

      {state?.result?.configured ? (
        <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {state.result.summary ? (
            <p><b>Özet:</b> {state.result.summary}</p>
          ) : null}
          {state.result.suggestedCategory ? (
            <p><b>Önerilen kategori:</b> {state.result.suggestedCategory}</p>
          ) : null}
          <div>
            <b>Benzer geçmiş ticket&apos;lar:</b>
            {state.result.similarTickets.length > 0 ? (
              <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                {state.result.similarTickets.map((t) => (
                  <li key={t.ticketNo}>{t.ticketNo} — {t.title}</li>
                ))}
              </ul>
            ) : (
              <span style={{ color: '#999' }}> benzer ticket bulunamadı.</span>
            )}
          </div>
          <span style={{ color: '#999', fontSize: 11 }}>Sağlayıcı: {state.result.provider}</span>
        </div>
      ) : null}
    </div>
  );
}
