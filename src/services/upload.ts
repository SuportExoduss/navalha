// Fotos: comprime no celular (WebP, até 1080 px, ~150 KB) e envia ao Worker
// da Cloudflare, que confere o token do Firebase e grava no R2.
// O Firestore guarda só o endereço público da foto.
// (Firebase Storage não é usado: exige o plano pago Blaze desde fev/2026.)
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { auth } from './firebase';

const WORKER_URL = process.env.EXPO_PUBLIC_WORKER_URL ?? 'http://127.0.0.1:8787';

export type TipoFoto = 'perfil' | 'barbearia' | 'servico' | 'corte' | 'banner';

export async function comprimir(uri: string): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri, { maxWidth: 1080, maxHeight: 1350 });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ compress: 0.72, format: SaveFormat.WEBP });
  return out.uri;
}

/** Sobe uma foto e devolve a URL pública para gravar no Firestore. */
export async function enviarFoto(uriLocal: string, tipo: TipoFoto, refId: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Entre na sua conta para enviar fotos.');
  const arquivo = await (await fetch(await comprimir(uriLocal))).blob();
  const resp = await fetch(`${WORKER_URL}/fotos?tipo=${tipo}&refId=${encodeURIComponent(refId)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'image/webp' },
    body: arquivo,
  });
  const corpo = (await resp.json().catch(() => ({}))) as { url?: string; erro?: string };
  if (!resp.ok || !corpo.url) throw new Error(corpo.erro ?? `Falha no envio da foto (${resp.status}).`);
  return corpo.url;
}
