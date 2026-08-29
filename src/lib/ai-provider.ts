import 'server-only';

// Faz 18 (AI) — emakbilisim/backend/lib/ai-provider.js İLE AYNI desen
// (bkz. proje hafızası emakbilisim_ai_integrations): sağlayıcıdan bağımsız,
// global env-var ile yapılandırılan, opsiyonel bir katman. Öncelik sırası:
//   1) GROQ_API_KEY varsa → Groq (ücretsiz katman, console.groq.com)
//   2) ANTHROPIC_API_KEY varsa → Claude
//   3) İkisi de yoksa → configured:false, çağıran taraf zarifçe atlar
// emakbilisim'in aksine burada npm bağımlılığı (@anthropic-ai/sdk) YOK —
// her iki sağlayıcı da doğrudan fetch ile çağrılıyor, tek dosyalık katman
// için ek bağımlılık gereksiz (madde 67: gereksiz abstraction/paket ekleme).
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const CLAUDE_MODEL = 'claude-sonnet-5';

export type AiProviderName = 'groq' | 'anthropic';

export interface AiAskResult {
  configured: boolean;
  provider: AiProviderName | null;
  reply: string;
}

function activeProviderName(): AiProviderName | null {
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return null;
}

export function isAiConfigured(): boolean {
  return activeProviderName() !== null;
}

async function callGroq(system: string, userMessage: string, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: system }, { role: 'user', content: userMessage }]
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `Groq API hatası (${res.status})`);
  return data.choices?.[0]?.message?.content || '';
}

async function callClaude(system: string, userMessage: string, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY as string,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: userMessage }] })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `Claude API hatası (${res.status})`);
  return data.content?.[0]?.text || '';
}

export async function askAi(system: string, userMessage: string, maxTokens = 500): Promise<AiAskResult> {
  const provider = activeProviderName();
  if (!provider) {
    return {
      configured: false,
      provider: null,
      reply: 'Yapay zeka asistanı yapılandırılmamış. Ücretsiz başlamak için console.groq.com üzerinden kredi kartsız bir API anahtarı alıp GROQ_API_KEY olarak .env dosyasına ekleyin.'
    };
  }
  const text = provider === 'groq' ? await callGroq(system, userMessage, maxTokens) : await callClaude(system, userMessage, maxTokens);
  return { configured: true, provider, reply: text };
}
