import tls from 'node:tls'

/**
 * Confía también en los certificados del sistema operativo, además de los que trae Node (como un
 * navegador). En equipos con antivirus o proxy que inspeccionan HTTPS, sin esto Node rechaza la
 * Test Wallet con UNABLE_TO_VERIFY_LEAF_SIGNATURE y ninguna llamada a Open Payments sale
 * (hallazgo D-32 del piloto). Va importado antes que todo en main.ts y en los scripts.
 */
tls.setDefaultCACertificates([...new Set([...tls.getCACertificates('default'), ...tls.getCACertificates('system')])])
