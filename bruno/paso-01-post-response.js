// Paso 1 · GET wallet address → descubrir AS y RS
// Pegar en: Request "1. Wallet address" → Script → Post Response
if (res.getStatus() !== 200) {
  throw new Error("Wallet address: HTTP " + res.getStatus());
}
const b = res.getBody();
bru.setEnvVar("auth_server", b.authServer);
bru.setEnvVar("resource_server", b.resourceServer);
bru.setEnvVar("jwks_url", b.jwksUrl || "");
console.log("auth_server     =", b.authServer);
console.log("resource_server =", b.resourceServer);
