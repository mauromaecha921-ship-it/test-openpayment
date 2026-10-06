// ============================================================================
// OPEN PAYMENTS · Firma HTTP RFC 9421 (Ed25519) · PRE-REQUEST GLOBAL (Bruno)
// ----------------------------------------------------------------------------
// Dónde pegarlo:  Colección → ⚙ Settings → Scripts → Pre Request
// Requisito:      "Developer Mode" activado en la colección
//                 (necesario para require("crypto") y Buffer)
//
// Qué hace: firma automáticamente TODA petición que
//   · tenga body (POST/PATCH con JSON), o
//   · tenga header "Authorization: GNAP <token>"
// excepto las llamadas al Test Wallet API (api-wallet), que van con cookie.
//
// Consecuencia (ver ENDPOINTS.md §4):
//   · Pasos 2,3,4,5,6,7,8,13,14,15,16,17  → se firman solos, no hay que
//     pegar nada en el pre-request de cada request.
//   · Pasos 1, 9, 10, 11, 12              → NO se firman (correcto).
// ============================================================================

const crypto = require("crypto");

// ---- helpers ---------------------------------------------------------------

// Busca la variable en runtime y en el entorno activo
const getVarAny = (name) => {
  try {
    const v = bru.getVar(name);
    if (v != null && v !== "") return v;
  } catch (e) {}
  try {
    const v = bru.getEnvVar(name);
    if (v != null && v !== "") return v;
  } catch (e) {}
  return "";
};

// Resuelve {{variables}} por si Bruno interpola DESPUÉS del pre-request.
// (Si ya están interpoladas, no toca nada.)
const interpolate = (s) =>
  typeof s === "string"
    ? s.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (m, n) => {
        const v = getVarAny(n.trim());
        return v === "" ? m : String(v);
      })
    : s;

// ---- datos de la petición ---------------------------------------------------

const method = req.getMethod().toUpperCase();
const targetUri = interpolate(req.getUrl());
const authorization = interpolate(
  req.getHeader("Authorization") || req.getHeader("authorization") || ""
);

// ---- body: normalizar a UN string exacto, minificado, en una línea ----------
// (El AS re-serializa el JSON; si firmas un body con saltos de línea →
//  401 invalid signature headers. Aquí garantizamos: lo firmado = lo enviado.)
let bodyStr = req.getBody();
if (bodyStr && typeof bodyStr !== "string") bodyStr = JSON.stringify(bodyStr);
if (typeof bodyStr === "string" && bodyStr.length > 0) {
  bodyStr = interpolate(bodyStr);
  try {
    bodyStr = JSON.stringify(JSON.parse(bodyStr)); // minificar
  } catch (e) {
    /* no era JSON: se usa tal cual */
  }
}
const hasBody = typeof bodyStr === "string" && bodyStr.length > 0;

// ---- ¿hay que firmar esta petición? -----------------------------------------

const apiWallet = getVarAny("api_wallet") || "https://api-wallet.interledger-test.dev";
const esApiWallet =
  targetUri.startsWith(apiWallet) || targetUri.includes("://api-wallet.");

const debeFirmar = !esApiWallet && (hasBody || authorization.startsWith("GNAP "));

if (!debeFirmar) {
  console.log(`[open-payments] sin firma: ${method} ${targetUri}`);
} else {
  const privateKeyPem = String(bru.getEnvVar("OP_PRIVATE_KEY_PEM") || "").replace(
    /\\n/g,
    "\n"
  );
  const keyId = bru.getEnvVar("OP_KEY_ID");
  if (!privateKeyPem) throw new Error("Falta OP_PRIVATE_KEY_PEM en el entorno");
  if (!keyId) throw new Error("Falta OP_KEY_ID en el entorno");

  // Fijar el body EXACTO que se va a enviar
  if (hasBody) {
    req.setBody(bodyStr);
    req.setHeader("Content-Type", "application/json");
  }

  // ---- componentes cubiertos por la firma (orden: ver ENDPOINTS.md §3) -------
  const components = [];
  const lines = [];
  const add = (name, value) => {
    components.push(`"${name}"`);
    lines.push(`"${name}": ${value}`);
  };

  add("@method", method);
  add("@target-uri", targetUri);

  let contentDigest = "";
  let contentLength = 0;
  if (hasBody) {
    const bodyBytes = Buffer.from(bodyStr, "utf8");
    contentLength = bodyBytes.length;
    contentDigest =
      "sha-512=:" + crypto.createHash("sha512").update(bodyBytes).digest("base64") + ":";
    add("content-digest", contentDigest);
    add("content-length", String(contentLength));
    add("content-type", "application/json");
  }
  if (authorization) add("authorization", authorization);

  // ---- base de firma + firma Ed25519 ------------------------------------------
  const created = Math.floor(Date.now() / 1000);
  const signatureParams = `(${components.join(" ")});keyid="${keyId}";created=${created}`;
  const signatureBase =
    lines.join("\n") + `\n"@signature-params": ${signatureParams}`;

  const privateKey = crypto.createPrivateKey({
    key: privateKeyPem,
    format: "pem",
    type: "pkcs8",
  });
  const signature = crypto
    .sign(null, Buffer.from(signatureBase, "utf8"), privateKey)
    .toString("base64");

  // ---- headers RFC 9421 ---------------------------------------------------------
  if (hasBody) {
    req.setHeader("Content-Digest", contentDigest);
    req.setHeader("Content-Length", String(contentLength));
  }
  req.setHeader("Signature-Input", `sig1=${signatureParams}`);
  req.setHeader("Signature", `sig1=:${signature}:`);

  console.log(`[open-payments] ✍ firmado: ${method} ${targetUri}`);
  console.log("[open-payments] Signature-Input:", `sig1=${signatureParams}`);
}
