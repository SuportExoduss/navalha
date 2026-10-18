const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright');
const BASE = 'http://127.0.0.1:8099';
async function contaEmulador(sub, nome) {
  const body = new URLSearchParams({ postBody: `id_token=${encodeURIComponent(JSON.stringify({ sub, email: `${sub}@teste.com`, name: nome, email_verified: true }))}&providerId=google.com`, requestUri: 'http://localhost', returnSecureToken: 'true' });
  const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo-key', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ postBody: body.get('postBody'), requestUri: 'http://localhost', returnSecureToken: true }),
  });
  const j = await r.json();
  if (!j.localId) throw new Error(JSON.stringify(j));
  return j;
}
async function entrar(browser, sub, nome, opcoes = {}) {
  const j = await contaEmulador(sub, nome);
  const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, ...opcoes });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log(`[${sub}] PAGEERR`, e.message));
  await p.goto(BASE + '/entrar');
  await p.waitForTimeout(2500);
  await p.evaluate(async ({ j, nome }) => {
    const user = {
      uid: j.localId, email: j.email, emailVerified: true, displayName: nome, isAnonymous: false,
      providerData: [{ providerId: 'google.com', uid: j.localId, displayName: nome, email: j.email, phoneNumber: null, photoURL: null }],
      stsTokenManager: { refreshToken: j.refreshToken, accessToken: j.idToken, expirationTime: Date.now() + 3600e3 },
      createdAt: String(Date.now()), lastLoginAt: String(Date.now()), apiKey: 'demo-key', appName: '[DEFAULT]',
    };
    await new Promise((res, rej) => {
      const req = indexedDB.open('firebaseLocalStorageDb', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' });
      req.onsuccess = () => {
        const tx = req.result.transaction('firebaseLocalStorage', 'readwrite');
        tx.objectStore('firebaseLocalStorage').put({ fbase_key: 'firebase:authUser:demo-key:[DEFAULT]', value: user });
        tx.oncomplete = res; tx.onerror = rej;
      };
      req.onerror = rej;
    });
  }, { j, nome });
  await p.goto(BASE + '/');
  await p.waitForTimeout(3500);
  return { ctx, p, uid: j.localId };
}
module.exports = { chromium, entrar, BASE };
