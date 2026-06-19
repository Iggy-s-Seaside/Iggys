// aes128gcm Web Push payload encryption — RFC 8291 (key derivation) + RFC 8188
// (content encoding). Portable: uses only the Web Crypto API (works in Deno edge and
// in Node 20+/tsx, so it's unit-testable against the RFC 8291 Appendix A vector).
//
// The flow, for a subscription { p256dh (receiver public), auth (16-byte secret) }:
//   1. Make an ephemeral application-server ECDH keypair (as_private/as_public).
//   2. ecdh_secret = ECDH(as_private, ua_public).
//   3. ikm  = HKDF(salt=auth, ikm=ecdh_secret, info="WebPush: info"\0 ua_pub as_pub, 32)
//   4. salt = 16 random bytes; PRK = HKDF-Extract(salt, ikm)
//      cek   = HKDF(salt, ikm, "Content-Encoding: aes128gcm"\0, 16)
//      nonce = HKDF(salt, ikm, "Content-Encoding: nonce"\0, 12)
//   5. record = payload || 0x02 (final-record delimiter); ciphertext = AES128GCM(cek,nonce,record)
//   6. body = salt(16) || rs(4, big-endian) || idlen(1=65) || as_public(65) || ciphertext

const RECORD_SIZE = 4096;

// ── base64url ──
export function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function bytesToB64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

// HKDF (extract + expand) via Web Crypto.
async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, lenBytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource },
    key,
    lenBytes * 8,
  );
  return new Uint8Array(bits);
}

export function importEcdhPublic(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
}

// Import a P-256 ECDH private key from its raw 32-byte scalar + the matching public
// point (raw 65 bytes, 0x04||x||y) by assembling a JWK.
export function importEcdhPrivate(dRaw: Uint8Array, publicRaw: Uint8Array): Promise<CryptoKey> {
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    d: bytesToB64url(dRaw),
    x: bytesToB64url(publicRaw.slice(1, 33)),
    y: bytesToB64url(publicRaw.slice(33, 65)),
    ext: true,
    key_ops: ['deriveBits'],
  };
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
}

const TE = new TextEncoder();
// key_info = "WebPush: info" \0 ua_public as_public   (RFC 8291 §3.3)
function webPushKeyInfo(uaPublic: Uint8Array, asPublic: Uint8Array): Uint8Array {
  return concat(TE.encode('WebPush: info'), new Uint8Array([0]), uaPublic, asPublic);
}
const CEK_INFO = concat(TE.encode('Content-Encoding: aes128gcm'), new Uint8Array([0]));
const NONCE_INFO = concat(TE.encode('Content-Encoding: nonce'), new Uint8Array([0]));

export interface ContentKeys { ecdhSecret: Uint8Array; ikm: Uint8Array; cek: Uint8Array; nonce: Uint8Array }

// Derive the content-encryption key + nonce. ECDH is symmetric, so this serves both
// the sender (ecdhPrivate=as, peer=ua) and a receiver/test (ecdhPrivate=ua, peer=as);
// key_info is always (ua_public, as_public) regardless of direction.
export async function deriveContentKeys(args: {
  uaPublic: Uint8Array;
  asPublic: Uint8Array;
  authSecret: Uint8Array;
  salt: Uint8Array;
  ecdhPrivate: CryptoKey;
  ecdhPeerPublic: CryptoKey;
}): Promise<ContentKeys> {
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: args.ecdhPeerPublic }, args.ecdhPrivate, 256),
  );
  const ikm = await hkdf(ecdhSecret, args.authSecret, webPushKeyInfo(args.uaPublic, args.asPublic), 32);
  const cek = await hkdf(ikm, args.salt, CEK_INFO, 16);
  const nonce = await hkdf(ikm, args.salt, NONCE_INFO, 12);
  return { ecdhSecret, ikm, cek, nonce };
}

/**
 * Encrypt a Web Push payload into a complete aes128gcm body.
 * `inject` lets a test pin the ephemeral keypair + salt to reproduce a known vector;
 * production omits it and a fresh keypair + random salt are generated per message.
 */
export async function encryptWebPush(
  payload: Uint8Array,
  p256dh: string,
  auth: string,
  inject?: { asPrivateRaw: Uint8Array; asPublicRaw: Uint8Array; salt: Uint8Array },
): Promise<Uint8Array> {
  const uaPublic = b64urlToBytes(p256dh);
  const authSecret = b64urlToBytes(auth);

  let asPublic: Uint8Array;
  let asPrivate: CryptoKey;
  let salt: Uint8Array;
  if (inject) {
    asPublic = inject.asPublicRaw;
    asPrivate = await importEcdhPrivate(inject.asPrivateRaw, inject.asPublicRaw);
    salt = inject.salt;
  } else {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
    asPrivate = pair.privateKey;
    salt = crypto.getRandomValues(new Uint8Array(16));
  }

  const { cek, nonce } = await deriveContentKeys({
    uaPublic, asPublic, authSecret, salt,
    ecdhPrivate: asPrivate,
    ecdhPeerPublic: await importEcdhPublic(uaPublic),
  });

  // record = payload || 0x02 (single, final record per RFC 8188).
  const record = concat(payload, new Uint8Array([2]));
  const cekKey = await crypto.subtle.importKey('raw', cek as BufferSource, { name: 'AES-GCM' }, false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce as BufferSource, tagLength: 128 }, cekKey, record as BufferSource),
  );

  // header: salt(16) || rs(4 BE) || idlen(1) || keyid(=as_public, 65)
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, RECORD_SIZE, false);
  const header = concat(salt, rs, new Uint8Array([asPublic.length]), asPublic);
  return concat(header, ciphertext);
}

/**
 * Decrypt an aes128gcm body back to the payload — RECEIVER side. Used only by the
 * verification test (round-trip + decrypting the reference library's output), never
 * shipped in the send path.
 */
export async function decryptWebPush(
  body: Uint8Array,
  uaPrivateRaw: Uint8Array,
  uaPublicRaw: Uint8Array,
  auth: string,
): Promise<Uint8Array> {
  const salt = body.slice(0, 16);
  const idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen);
  const ciphertext = body.slice(21 + idlen);
  const authSecret = b64urlToBytes(auth);

  const { cek, nonce } = await deriveContentKeys({
    uaPublic: uaPublicRaw,
    asPublic,
    authSecret,
    salt,
    ecdhPrivate: await importEcdhPrivate(uaPrivateRaw, uaPublicRaw),
    ecdhPeerPublic: await importEcdhPublic(asPublic),
  });

  const cekKey = await crypto.subtle.importKey('raw', cek as BufferSource, { name: 'AES-GCM' }, false, ['decrypt']);
  const record = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce as BufferSource, tagLength: 128 }, cekKey, ciphertext as BufferSource),
  );
  // Strip the trailing 0x02 (final-record delimiter) and any zero padding.
  let end = record.length;
  while (end > 0 && record[end - 1] === 0) end--;
  if (end > 0 && record[end - 1] === 2) end--;
  return record.slice(0, end);
}
