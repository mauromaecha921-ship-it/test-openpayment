// Variables falsas para las pruebas: ningún valor es real.
Object.assign(process.env, {
  TATU_SIN_ENV_ARCHIVO: '1',
  PORT: '3999',
  APP_BASE_URL: 'http://localhost:5173',
  API_BASE_URL: 'http://localhost:3999/api',
  LIQUIDACION_URL: 'http://localhost:3999/api/liquidacion',
  DATABASE_URL: 'pglite:memoria',
  OP_CLIENT_WALLET_ADDRESS: 'https://ilp.interledger-test.dev/prueba-cliente',
  OP_KEY_ID: 'llave-de-prueba',
  DEMO_WALLET_PROGRAMA: 'https://ilp.interledger-test.dev/prueba-programa',
  DEMO_WALLET_ANA: 'https://ilp.interledger-test.dev/prueba-ana',
  DEMO_WALLET_LUIS: 'https://ilp.interledger-test.dev/prueba-luis',
  DEMO_WALLET_PUNTO: 'https://ilp.interledger-test.dev/prueba-punto',
  VERIFICACION_CUENTA: 'subject',
  LIQUIDACION_SIMULAR_FALLA: 'false',
})
