/* ==========================================================================
   Vertikal: klien backend bersama untuk dashboard (assets/app.js) dan chat
   (assets/ai-chat.js). Satu login guru berlaku untuk keduanya.

   Endpoint: <meta name="vertikal-ai-endpoint" content="...">
     - "api/chat.php"                      backend PHP lokal (XAMPP), sesi cookie
     - "https://nama.akun.workers.dev/"    Cloudflare Worker (GitHub Pages), sesi token
   Event "vertikal:auth" dikirim ke window setiap kali login berhasil atau sesi berakhir.
   ========================================================================== */
(() => {
  'use strict';

  const ENDPOINT = document.querySelector('meta[name="vertikal-ai-endpoint"]')?.content.trim() || 'api/chat.php';
  const REMOTE = /^https?:\/\//i.test(ENDPOINT);
  // Token Worker hanya di sessionStorage tab ini (hilang saat tab ditutup).
  const TOKEN = 'vertikal-ai.token.v1';
  const CONV = 'vertikal-ai.conv.v1';
  const ss = {
    get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { if (v) sessionStorage.setItem(k, v); else sessionStorage.removeItem(k); } catch { /* abaikan */ } },
  };
  const emit = (authed) => window.dispatchEvent(new CustomEvent('vertikal:auth', { detail: { authed } }));

  /** body = null untuk status (GET), selain itu POST JSON. Hasil selalu objek, tidak pernah throw. */
  async function call(body) {
    const opts = { method: body ? 'POST' : 'GET', credentials: REMOTE ? 'omit' : 'same-origin', headers: { 'X-Vertikal-AI': '1' } };
    const token = ss.get(TOKEN);
    if (token) opts.headers.Authorization = `Bearer ${token}`;
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const url = body ? ENDPOINT : `${ENDPOINT}${ENDPOINT.includes('?') ? '&' : '?'}action=status`;
    let res;
    try { res = await fetch(url, opts); } catch { return { ok: false, network: true }; }
    let data = null;
    try { data = await res.json(); } catch { /* bukan JSON: hosting tanpa backend */ }
    if (!data) return { ok: false, nophp: true, status: res.status };
    if (data.token) ss.set(TOKEN, data.token);
    if (data.conv) ss.set(CONV, data.conv);
    if (res.status === 401 && token) { ss.set(TOKEN, null); emit(false); }
    return { ...data, status: res.status };
  }

  async function login(code) {
    const r = await call({ action: 'login', code });
    if (r.ok) emit(true);
    return r;
  }
  async function logout() {
    await call({ action: 'logout' });
    ss.set(TOKEN, null); ss.set(CONV, null);
    emit(false);
  }

  window.VertikalAPI = {
    endpoint: ENDPOINT,
    remote: REMOTE,
    // Endpoint relatif tidak bisa dipakai dari file:// (tidak ada server).
    available: REMOTE || location.protocol !== 'file:',
    call,
    login,
    logout,
    conv: { get: () => ss.get(CONV), clear: () => ss.set(CONV, null) },
  };
})();
