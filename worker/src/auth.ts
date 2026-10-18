// Verifica o ID token do Firebase Auth sem SDK (Web Crypto, poucos ms de CPU).
// Regras: https://firebase.google.com/docs/auth/admin/verify-id-tokens
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

interface Jwk extends JsonWebKey { kid: string }
let cacheChaves: { chaves: Map<string, CryptoKey>; expira: number } | null = null;

function b64urlParaBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function decodificarParte<T>(parte: string): T {
  return JSON.parse(new TextDecoder().decode(b64urlParaBytes(parte))) as T;
}

async function chavesGoogle(): Promise<Map<string, CryptoKey>> {
  if (cacheChaves && cacheChaves.expira > Date.now()) return cacheChaves.chaves;
  const r = await fetch(JWKS_URL);
  const { keys } = (await r.json()) as { keys: Jwk[] };
  const maxAge = Number(/max-age=(\d+)/.exec(r.headers.get('cache-control') ?? '')?.[1] ?? 3600);
  const chaves = new Map<string, CryptoKey>();
  for (const k of keys) {
    chaves.set(k.kid, await crypto.subtle.importKey('jwk', k, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']));
  }
  cacheChaves = { chaves, expira: Date.now() + maxAge * 1000 };
  return chaves;
}

export interface Claims { sub: string; aud: string; iss: string; exp: number; iat: number; auth_time: number }

/** Valida formato e regras das claims (separado para poder testar sem rede). */
export function validarClaims(c: Claims, projectId: string, agoraSeg = Math.floor(Date.now() / 1000)): string | null {
  if (c.aud !== projectId) return 'aud';
  if (c.iss !== `https://securetoken.google.com/${projectId}`) return 'iss';
  if (!c.sub || typeof c.sub !== 'string' || c.sub.length > 128) return 'sub';
  if (c.exp <= agoraSeg) return 'exp';
  if (c.iat > agoraSeg + 300 || c.auth_time > agoraSeg + 300) return 'iat';
  return null;
}

/** Devolve o uid do usuário ou null se o token for inválido. */
export async function verificarIdToken(token: string, projectId: string): Promise<string | null> {
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  const [h, p, s] = partes;
  const header = decodificarParte<{ alg: string; kid: string }>(h);
  if (header.alg !== 'RS256') return null;
  const chave = (await chavesGoogle()).get(header.kid);
  if (!chave) return null;
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', chave, b64urlParaBytes(s), new TextEncoder().encode(`${h}.${p}`),
  );
  if (!ok) return null;
  const claims = decodificarParte<Claims>(p);
  return validarClaims(claims, projectId) ? null : claims.sub;
}
