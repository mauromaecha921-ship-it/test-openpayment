// Paso 13 · POST continue_uri → canjear interact_ref por el token real
// Pegar en: Request "13. Canjear grant" → Script → Post Response
if (res.getStatus() !== 200 && res.getStatus() !== 201) {
  throw new Error(
    "Continue: HTTP " + res.getStatus() + " → " + JSON.stringify(res.getBody())
  );
}
const b = res.getBody();
bru.setEnvVar("token_outgoing", b.access_token.value);
bru.setEnvVar("token_outgoing_manage", b.access_token.manage || "");
console.log("token_outgoing guardado (expira en", b.access_token.expires_in, "s)");
