// Acesso mínimo ao Firestore pela API REST, com conta de serviço.
// O token OAuth fica em cache por ~55 min para não estourar os 10 ms de CPU
// do plano gratuito assinando RSA a cada execução.
let cacheToken: { token: string; expira: number } | null = null;

function b64url(bytes: ArrayBuffer | Uint8Array | string): string {
  const u8 = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : new Uint8Array(bytes);
  let bin = '';
  for (const b of u8) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function tokenGoogle(email: string, chavePem: string): Promise<string> {
  if (cacheToken && cacheToken.expira > Date.now()) return cacheToken.token;
  const pem = chavePem.replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const chave = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const agora = Math.floor(Date.now() / 1000);
  const corpo = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({
    iss: email, scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token', iat: agora, exp: agora + 3600,
  }))}`;
  const assinatura = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', chave, new TextEncoder().encode(corpo));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${corpo}.${b64url(assinatura)}`,
  });
  if (!r.ok) throw new Error(`OAuth Google ${r.status}: ${await r.text()}`);
  const { access_token, expires_in } = (await r.json()) as { access_token: string; expires_in: number };
  cacheToken = { token: access_token, expira: Date.now() + (expires_in - 300) * 1000 };
  return access_token;
}

type Valor = { integerValue?: string; doubleValue?: number; stringValue?: string; booleanValue?: boolean; nullValue?: null; mapValue?: { fields?: Record<string, Valor> }; arrayValue?: { values?: Valor[] } };

export function lerValor(v: Valor | undefined): unknown {
  if (!v) return undefined;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if (v.mapValue) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, lerValor(x)]));
  if (v.arrayValue) return (v.arrayValue.values ?? []).map(lerValor);
  return undefined;
}

export class Firestore {
  constructor(private projectId: string, private token: string) {}
  private get base() { return `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents`; }
  private headers() { return { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' }; }

  async query(structuredQuery: unknown): Promise<{ id: string; dados: Record<string, unknown> }[]> {
    const r = await fetch(`${this.base}:runQuery`, { method: 'POST', headers: this.headers(), body: JSON.stringify({ structuredQuery }) });
    if (!r.ok) throw new Error(`runQuery ${r.status}: ${await r.text()}`);
    const linhas = (await r.json()) as { document?: { name: string; fields: Record<string, Valor> } }[];
    return linhas.filter(l => l.document).map(l => ({
      id: l.document!.name.split('/').pop()!,
      dados: Object.fromEntries(Object.entries(l.document!.fields).map(([k, v]) => [k, lerValor(v)])),
    }));
  }

  async get(caminho: string): Promise<Record<string, unknown> | null> {
    const r = await fetch(`${this.base}/${caminho}`, { headers: this.headers() });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`get ${r.status}`);
    const d = (await r.json()) as { fields: Record<string, Valor> };
    return Object.fromEntries(Object.entries(d.fields ?? {}).map(([k, v]) => [k, lerValor(v)]));
  }

  /** Atualiza só um campo inteiro (ex.: lembretes.h24). */
  async marcarNumero(caminho: string, campo: string, valor: number) {
    const r = await fetch(`${this.base}/${caminho}?updateMask.fieldPaths=${encodeURIComponent(campo)}`, {
      method: 'PATCH', headers: this.headers(),
      body: JSON.stringify({ fields: montarCampo(campo.split('.'), { integerValue: String(valor) }) }),
    });
    if (!r.ok) throw new Error(`patch ${r.status}`);
  }
}

function montarCampo(partes: string[], folha: Valor): Record<string, Valor> {
  const [p, ...resto] = partes;
  return { [p]: resto.length ? { mapValue: { fields: montarCampo(resto, folha) } } : folha };
}
