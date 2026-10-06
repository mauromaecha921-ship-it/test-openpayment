// Paso 9 · GET interact_url (302) → capturar interact_id, nonce y cookies del AS
// Pegar en: Request "9. Abrir interacción" → Script → Post Response
const loc = res.getHeader("location") || res.getHeader("Location") || "";
console.log("HTTP", res.getStatus(), "→ Location:", loc);

const i = loc.match(/[?&]interactId=([^&]+)/);
const n = loc.match(/[?&]nonce=([^&]+)/);
if (!i || !n) {
  throw new Error("No se pudo extraer interactId/nonce del Location: " + loc);
}
bru.setEnvVar("interact_id", decodeURIComponent(i[1]));
bru.setEnvVar("nonce", decodeURIComponent(n[1]));

// Cookies de sesión del AS (sessionId y sessionId.sig) para el paso 12
let sc = res.getHeader("set-cookie") || res.getHeader("Set-Cookie") || [];
if (typeof sc === "string") sc = [sc];
const asCookie = sc.map((c) => c.split(";")[0]).join("; ");
bru.setEnvVar("as_cookie", asCookie);

// Origen del AS (para montar la URL /finish del paso 12)
const interactUrl = bru.getEnvVar("interact_url") || "";
const o = interactUrl.match(/^(https?:\/\/[^/]+)/i);
if (o) bru.setEnvVar("as_origin", o[1]);

console.log("interact_id =", i[1]);
console.log("nonce       =", n[1]);
console.log("as_origin   =", o ? o[1] : "(no detectado)");
console.log("as_cookie   =", asCookie);
