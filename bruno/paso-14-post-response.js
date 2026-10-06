// Paso 14 · POST outgoing-payments → guardar outgoing_payment_url
// Pegar en: Request "14. Ejecutar pago saliente" → Script → Post Response
if (res.getStatus() !== 201) {
  throw new Error(
    "outgoing-payment: HTTP " + res.getStatus() + " → " + JSON.stringify(res.getBody())
  );
}
const b = res.getBody();
bru.setEnvVar("outgoing_payment_url", b.id);
console.log("outgoing_payment_url =", b.id, "| state:", b.state);
