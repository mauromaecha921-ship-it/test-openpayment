// Paso 8 · POST grant outgoing-payment (interactivo)
//          → guardar interact_url, continue_uri, continue_token
// Pegar en: Request "8. Grant outgoing-payment" → Script → Post Response
if (res.getStatus() !== 200 && res.getStatus() !== 201) {
  throw new Error(
    "Grant outgoing-payment: HTTP " + res.getStatus() + " → " + JSON.stringify(res.getBody())
  );
}
const b = res.getBody();
bru.setEnvVar("interact_url", b.interact.redirect);
bru.setEnvVar("continue_uri", b.continue.uri);
bru.setEnvVar("continue_token", b.continue.access_token.value);
bru.setEnvVar("interact_finish", b.interact.finish || "");
console.log("interact_url  =", b.interact.redirect);
console.log("continue_uri  =", b.continue.uri);
console.log("→ Siguiente: paso 9 (abrir la interacción)");
