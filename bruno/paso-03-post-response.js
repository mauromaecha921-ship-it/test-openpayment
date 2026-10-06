// Paso 3 · POST incoming-payments → guardar incoming_payment_url
// Pegar en: Request "3. Crear incoming payment" → Script → Post Response
if (res.getStatus() !== 201) {
  throw new Error(
    "incoming-payment: HTTP " + res.getStatus() + " → " + JSON.stringify(res.getBody())
  );
}
const b = res.getBody();
bru.setEnvVar("incoming_payment_url", b.id);
console.log("incoming_payment_url =", b.id, "| state:", b.state);
