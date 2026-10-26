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
    // androidpublisher: conferir as assinaturas no Google Play (a conta precisa estar ligada na Play Console).
    iss: email, scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/androidpublisher' +
      // métricas: relatórios da Play no bucket do desenvolvedor e Android vitals.
      ' https://www.googleapis.com/auth/devstorage.read_only https://www.googleapis.com/auth/playdeveloperreporting',
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

/** Valor de `escrever` que apaga o campo (fica na máscara sem valor, como o deleteField do SDK). */
export const APAGAR = Symbol('apagar');

export class Firestore {
  constructor(private projectId: string, private token: string) {}
  private get base() { return `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents`; }
  private headers() { return { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' }; }

  /** `pai` para consultar uma subcoleção, ex.: "barbearias/abc" + from barbeiros. */
  async query(structuredQuery: unknown, pai = ''): Promise<{ id: string; dados: Record<string, unknown> }[]> {
    const r = await fetch(`${this.base}${pai ? '/' + pai : ''}:runQuery`, { method: 'POST', headers: this.headers(), body: JSON.stringify({ structuredQuery }) });
    if (!r.ok) throw new Error(`runQuery ${r.status}: ${await r.text()}`);
    const linhas = (await r.json()) as { document?: { name: string; fields: Record<string, Valor> } }[];
    return linhas.filter(l => l.document).map(l => ({
      id: l.document!.name.split('/').pop()!,
      dados: Object.fromEntries(Object.entries(l.document!.fields).map(([k, v]) => [k, lerValor(v)])),
    }));
  }

  /** Quantos documentos a consulta acha (agregação: 1 leitura a cada 1.000 documentos). */
  async contar(structuredQuery: unknown): Promise<number> {
    const r = await fetch(`${this.base}:runAggregationQuery`, {
      method: 'POST', headers: this.headers(),
      body: JSON.stringify({ structuredAggregationQuery: { structuredQuery, aggregations: [{ alias: 'n', count: {} }] } }),
    });
    if (!r.ok) throw new Error(`runAggregationQuery ${r.status}: ${await r.text()}`);
    const [l] = (await r.json()) as { result?: { aggregateFields?: { n?: Valor } } }[];
    return Number(lerValor(l?.result?.aggregateFields?.n) ?? 0);
  }

  /** Vários documentos numa chamada só (o plano grátis do Worker limita as chamadas por execução). */
  async varios(caminhos: string[]): Promise<Map<string, Record<string, unknown>>> {
    const res = new Map<string, Record<string, unknown>>();
    if (!caminhos.length) return res;
    const raiz = `projects/${this.projectId}/databases/(default)/documents/`;
    const r = await fetch(`${this.base}:batchGet`, {
      method: 'POST', headers: this.headers(), body: JSON.stringify({ documents: caminhos.map(c => raiz + c) }),
    });
    if (!r.ok) throw new Error(`batchGet ${r.status}`);
    for (const l of (await r.json()) as { found?: { name: string; fields?: Record<string, Valor> } }[]) {
      if (!l.found) continue;
      res.set(l.found.name.slice(raiz.length), Object.fromEntries(Object.entries(l.found.fields ?? {}).map(([k, v]) => [k, lerValor(v)])));
    }
    return res;
  }

  /**
   * Grava campos (chaves com ponto = campo dentro de mapa) em vários documentos, numa chamada só.
   * `criar`: o documento pode não existir ainda; sem ele, exige que exista.
   */
  async escrever(lista: { caminho: string; campos: Record<string, unknown>; criar?: boolean }[]) {
    if (!lista.length) return;
    const raiz = `projects/${this.projectId}/databases/(default)/documents/`;
    const writes = lista.map(({ caminho, campos, criar }) => {
      const fields: Record<string, Valor> = {};
      for (const [k, v] of Object.entries(campos)) if (v !== APAGAR) mesclar(fields, montarCampo(k.split('.'), paraValor(v)));
      return {
        update: { name: raiz + caminho, fields },
        updateMask: { fieldPaths: Object.keys(campos) },
        ...(criar ? {} : { currentDocument: { exists: true } }),
      };
    });
    const r = await fetch(`${this.base}:commit`, { method: 'POST', headers: this.headers(), body: JSON.stringify({ writes }) });
    if (!r.ok) throw new Error(`commit ${r.status}: ${await r.text()}`);
  }

  /** Apaga vários documentos numa chamada só (até 500; documento que não existe é ignorado). */
  async apagar(caminhos: string[]) {
    if (!caminhos.length) return;
    const raiz = `projects/${this.projectId}/databases/(default)/documents/`;
    const r = await fetch(`${this.base}:commit`, {
      method: 'POST', headers: this.headers(), body: JSON.stringify({ writes: caminhos.map(c => ({ delete: raiz + c })) }),
    });
    if (!r.ok) throw new Error(`commit ${r.status}: ${await r.text()}`);
  }

  /** O mesmo campo inteiro em vários documentos, numa gravação só (até 500). */
  async marcarVarios(caminhos: string[], campo: string, valor: number) {
    if (!caminhos.length) return;
    const raiz = `projects/${this.projectId}/databases/(default)/documents/`;
    const writes = caminhos.map(c => ({
      update: { name: raiz + c, fields: montarCampo(campo.split('.'), { integerValue: String(valor) }) },
      updateMask: { fieldPaths: [campo] },
      currentDocument: { exists: true },
    }));
    const r = await fetch(`${this.base}:commit`, { method: 'POST', headers: this.headers(), body: JSON.stringify({ writes }) });
    if (!r.ok) throw new Error(`commit ${r.status}: ${await r.text()}`);
  }
}

export function paraValor(x: unknown): Valor {
  if (x === null || x === undefined) return { nullValue: null };
  if (typeof x === 'boolean') return { booleanValue: x };
  if (typeof x === 'number') return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (typeof x === 'string') return { stringValue: x };
  if (Array.isArray(x)) return { arrayValue: { values: x.map(paraValor) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(x as object).map(([k, v]) => [k, paraValor(v)])) } };
}

/** Junta "assinatura.status" e "assinatura.plano" no mesmo mapa. */
function mesclar(alvo: Record<string, Valor>, novo: Record<string, Valor>) {
  for (const [k, v] of Object.entries(novo)) {
    const atual = alvo[k];
    if (atual?.mapValue && v.mapValue) mesclar((atual.mapValue.fields ??= {}), v.mapValue.fields ?? {});
    else alvo[k] = v;
  }
}

function montarCampo(partes: string[], folha: Valor): Record<string, Valor> {
  const [p, ...resto] = partes;
  return { [p]: resto.length ? { mapValue: { fields: montarCampo(resto, folha) } } : folha };
}
