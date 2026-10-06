// Paso 2 · POST grant incoming-payment → guardar token_incoming
// Pegar en: Request "2. Grant incoming-payment" → Script → Post Response
if (res.getStatus() !== 200) {
  throw new Error(
    "Grant incoming-payment: HTTP " + res.getStatus() + " → " + JSON.stringify(res.getBody())
  );
}
const b = res.getBody();
bru.setEnvVar("token_incoming", b.access_token.value);
bru.setEnvVar("token_incoming_manage", b.access_token.manage || "");
console.log("token_incoming guardado (expira en", b.access_token.expires_in, "s)");
