// SCRIPT GENERAR GRANT PARA INCOMING PAYMENT (script pre-request para cliente Bruno)

const crypto = require("crypto");

// ============================================================
// Variables
// ============================================================

const privateKeyPem = bru.getEnvVar("OP_PRIVATE_KEY_PEM"); // TODO: CARGAR LA CLAVES PRIVADA
const keyId = bru.getEnvVar("OP_KEY_ID"); // TODO: CARGAR KEY_ID

if (!privateKeyPem) {
  throw new Error("Falta OP_PRIVATE_KEY_PEM");
}

if (!keyId) {
  throw new Error("Falta OP_KEY_ID");
}

// ============================================================
// Body EXACTO que vamos a enviar
// ============================================================

const body = JSON.stringify({
  access_token: {
    access: [
      {
        type: "incoming-payment",
        actions: ["create", "read", "read-all", "list", "complete"],
      },
    ],
  },
  client: "https://ilp.interledger-test.dev/direccion-wallet", // TODO: Aqui va la direcci├│n de la wallet
});

// Importante: enviamos exactamente este string.
// Así el digest y la firma corresponden a los bytes enviados.
req.setBody(body);

req.setHeader("Content-Type", "application/json");

// ============================================================
// Datos HTTP
// ============================================================

const method = req.getMethod().toUpperCase();
const targetUri = req.getUrl();

// Bytes UTF-8 exactos del body
const bodyBytes = Buffer.from(body, "utf8");

// Content-Length real
const contentLength = bodyBytes.length;

// ============================================================
// Content-Digest
// ============================================================

const digest = crypto.createHash("sha512").update(bodyBytes).digest("base64");

const contentDigest = `sha-512=:${digest}:`;

// ============================================================
// Timestamp RFC 9421
// ============================================================

const created = Math.floor(Date.now() / 1000);

// ============================================================
// Signature-Input
// ============================================================

const components = [
  "@method",
  "@target-uri",
  "content-digest",
  "content-length",
  "content-type",
];

const signatureParams =
  `(${components.map((c) => `"${c}"`).join(" ")})` +
  `;keyid="${keyId}"` +
  `;created=${created}`;

// ============================================================
// Signature Base
// ============================================================

const signatureBase =
  `"@method": ${method}\n` +
  `"@target-uri": ${targetUri}\n` +
  `"content-digest": ${contentDigest}\n` +
  `"content-length": ${contentLength}\n` +
  `"content-type": application/json\n` +
  `"@signature-params": ${signatureParams}`;

// ============================================================
// Firmar con Ed25519
// ============================================================

const privateKey = crypto.createPrivateKey({
  key: privateKeyPem,
  format: "pem",
  type: "pkcs8",
});

const signature = crypto
  .sign(null, Buffer.from(signatureBase, "utf8"), privateKey)
  .toString("base64");

// ============================================================
// Headers RFC 9421
// ============================================================

const signatureInput = `sig1=${signatureParams}`;

const signatureHeader = `sig1=:${signature}:`;

req.setHeader("Content-Digest", contentDigest);
req.setHeader("Content-Length", String(contentLength));
req.setHeader("Signature-Input", signatureInput);
req.setHeader("Signature", signatureHeader);

// ============================================================
// Debug
// ============================================================

console.log("=== Open Payments RFC 9421 ===");
console.log("Method:", method);
console.log("Target URI:", targetUri);
console.log("Content-Length:", contentLength);
console.log("Content-Digest:", contentDigest);
console.log("Key ID:", keyId);
console.log("Created:", created);
console.log("Signature-Input:", signatureInput);
console.log("Signature Base:");
console.log(signatureBase);
console.log("Signature:", signatureHeader);
