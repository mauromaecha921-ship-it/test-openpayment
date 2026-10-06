// Paso 5 · POST grant quote → guardar token_quote
// Pegar en: Request "5. Grant quote" → Script → Post Response
if (res.getStatus() !== 200) {
  throw new Error(
    "Grant quote: HTTP " + res.getStatus() + " → " + JSON.stringify(res.getBody())
  );
}
const b = res.getBody();
bru.setEnvVar("token_quote", b.access_token.value);
bru.setEnvVar("token_quote_manage", b.access_token.manage || "");
console.log("token_quote guardado (expira en", b.access_token.expires_in, "s)");
