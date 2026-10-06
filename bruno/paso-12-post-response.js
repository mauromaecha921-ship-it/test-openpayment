// Paso 12 · GET .../finish (302) → extraer interact_ref del hash del Location
// Pegar en: Request "12. Finish" → Script → Post Response
const loc = res.getHeader("location") || res.getHeader("Location") || "";
console.log("HTTP", res.getStatus(), "→ Location:", loc);

const m = loc.match(/interact_ref=([^&\s]+)/);
if (!m) {
  throw new Error(
    "Sin interact_ref en el Location. ¿Aceptaste el grant en el paso 11? Location: " + loc
  );
}
bru.setEnvVar("interact_ref", decodeURIComponent(m[1]));
console.log("interact_ref guardado:", m[1]);
