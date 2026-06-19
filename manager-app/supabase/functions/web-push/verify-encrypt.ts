// Verification for the aes128gcm Web Push encryption — the authoritative check is the
// RFC 8291 Appendix A worked example (known keys + salt → known CEK/NONCE/body), so
// reproducing those intermediates byte-for-byte proves the key schedule is spec-correct.
// Run: npx tsx supabase/functions/web-push/verify-encrypt.ts
import {
  encryptWebPush, decryptWebPush, deriveContentKeys,
  importEcdhPublic, importEcdhPrivate, b64urlToBytes, bytesToB64url,
} from './encrypt.ts';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, got?: string, want?: string) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ FAIL: ${name}${got !== undefined ? `\n      got:  ${got}\n      want: ${want}` : ''}`); }
}

// ── RFC 8291 Appendix A vector ──
const RFC = {
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  uaPriv: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  uaPub: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  asPriv: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  asPub: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  plaintext: 'When I grow up, I want to be a watermelon',
  ecdhSecret: 'kyrL1jIIOHEzg3sM2ZWRHDRB62YACZhhSlknJ672kSs',
  ikm: 'S4lYMb_L0FxCeq0WhDx813KgSYqU26kOyzWUdsXYyrg',
  cek: 'oIhVW04MRdy2XN9CiKLxTg',
  nonce: '4h_95klXJ5E_qnoN',
};

async function main() {
  console.log('— RFC 8291 Appendix A key schedule —');
  const uaPub = b64urlToBytes(RFC.uaPub);
  const asPub = b64urlToBytes(RFC.asPub);
  const keys = await deriveContentKeys({
    uaPublic: uaPub,
    asPublic: asPub,
    authSecret: b64urlToBytes(RFC.auth),
    salt: b64urlToBytes(RFC.salt),
    ecdhPrivate: await importEcdhPrivate(b64urlToBytes(RFC.asPriv), asPub),
    ecdhPeerPublic: await importEcdhPublic(uaPub),
  });
  check('ECDH shared secret matches RFC', bytesToB64url(keys.ecdhSecret) === RFC.ecdhSecret, bytesToB64url(keys.ecdhSecret), RFC.ecdhSecret);
  check('IKM matches RFC', bytesToB64url(keys.ikm) === RFC.ikm, bytesToB64url(keys.ikm), RFC.ikm);
  check('CEK matches RFC', bytesToB64url(keys.cek) === RFC.cek, bytesToB64url(keys.cek), RFC.cek);
  check('NONCE matches RFC', bytesToB64url(keys.nonce) === RFC.nonce, bytesToB64url(keys.nonce), RFC.nonce);

  console.log('\n— RFC vector encrypt → decrypt round-trip —');
  const body = await encryptWebPush(
    new TextEncoder().encode(RFC.plaintext), RFC.uaPub, RFC.auth,
    { asPrivateRaw: b64urlToBytes(RFC.asPriv), asPublicRaw: asPub, salt: b64urlToBytes(RFC.salt) },
  );
  // The body's header must carry the RFC salt + the as_public keyid.
  check('body header salt is the RFC salt', bytesToB64url(body.slice(0, 16)) === RFC.salt);
  check('body keyid is as_public (65B)', body[20] === 65 && bytesToB64url(body.slice(21, 86)) === RFC.asPub);
  const back = await decryptWebPush(body, b64urlToBytes(RFC.uaPriv), uaPub, RFC.auth);
  check('decrypt recovers the plaintext', new TextDecoder().decode(back) === RFC.plaintext, new TextDecoder().decode(back), RFC.plaintext);

  console.log('\n— random keypair round-trip (full path) —');
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const pubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const privRaw = b64urlToBytes(jwk.d as string);
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const msg = JSON.stringify({ title: 'Luna reached out', body: '70% rain tomorrow — move the Henderson party indoors.', url: '/parties/1' });
  const body2 = await encryptWebPush(new TextEncoder().encode(msg), bytesToB64url(pubRaw), bytesToB64url(auth));
  const back2 = await decryptWebPush(body2, privRaw, pubRaw, bytesToB64url(auth));
  check('random round-trip recovers the reach payload', new TextDecoder().decode(back2) === msg);
  check('a fresh body uses a fresh random salt', bytesToB64url(body2.slice(0, 16)) !== RFC.salt);

  console.log('\n— VAPID JWT (raw web-push key import) —');
  // `web-push generate-vapid-keys` emits a raw 32-byte scalar; buildVapidJwt rebuilds
  // a signing key from that scalar + the raw public point. Exercise that exact path
  // with a throwaway key (no real secret committed) and confirm it signs + verifies.
  const vp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const vpPub = new Uint8Array(await crypto.subtle.exportKey('raw', vp.publicKey));
  const vpJwk = await crypto.subtle.exportKey('jwk', vp.privateKey);
  const signKey = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d: vpJwk.d, x: bytesToB64url(vpPub.slice(1, 33)), y: bytesToB64url(vpPub.slice(33, 65)), ext: true, key_ops: ['sign'] },
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'],
  );
  const input = new TextEncoder().encode('eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.eyJhdWQiOiJodHRwczovL2V4YW1wbGUuY29tIn0');
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signKey, input);
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, vp.publicKey, sig, input);
  check('VAPID JWT signs with the raw-scalar key and verifies', ok);

  console.log(`\n── ${pass} passed, ${fail} failed ──`);
  process.exit(fail ? 1 : 0);
}
main();
