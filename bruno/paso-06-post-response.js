// Paso 6 · POST quotes → guardar quote_url
// Pegar en: Request "6. Crear quote" → Script → Post Response
if (res.getStatus() !== 201) {
  throw new Error(
    "quote: HTTP " + res.getStatus() + " → " + JSON.stringify(res.getBody())
  );
}
const b = res.getBody();
bru.setEnvVar("quote_url", b.id);
console.log("quote_url =", b.id);
console.log("debitAmount:", JSON.stringify(b.debitAmount), "| receiveAmount:", JSON.stringify(b.receiveAmount));
