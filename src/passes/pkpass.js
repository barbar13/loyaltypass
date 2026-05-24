const forge  = require('node-forge');
const JSZip  = require('jszip');
const crypto = require('node:crypto');
const { solidPng, hexToRgb, hexToRgbStr } = require('./png');

function sha1hex(buf) {
  return crypto.createHash('sha1').update(buf).digest('hex');
}

function buildPassJson({ card, customer, merchant }) {
  const displayName = customer.first_name || customer.phone || 'Client';
  return JSON.stringify({
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID   || 'pass.com.fidelyzio.card',
    teamIdentifier:     process.env.APPLE_TEAM_ID         || 'TEAM00000',
    serialNumber:       card.qr_code,
    organizationName:   merchant.name,
    description:        `Carte de fidélité ${merchant.name}`,
    logoText:           merchant.name,
    backgroundColor:    hexToRgbStr(merchant.color),
    foregroundColor:    'rgb(255, 255, 255)',
    labelColor:         'rgba(255, 255, 255, 0.7)',
    storeCard: {
      headerFields: [
        { key: 'program', label: 'PROGRAMME', value: 'FIDELYZIO' },
      ],
      primaryFields: [
        { key: 'points', label: 'POINTS', value: String(card.points), textAlignment: 'PKTextAlignmentCenter' },
      ],
      secondaryFields: [
        { key: 'name', label: 'TITULAIRE', value: displayName },
      ],
      backFields: [
        { key: 'merchant', label: 'Établissement', value: merchant.name },
        { key: 'phone',    label: 'Téléphone',     value: customer.phone || '' },
        { key: 'info',     label: 'À propos',      value: 'Présentez ce QR code à la caisse pour cumuler vos points fidélité.' },
      ],
    },
    barcodes: [{
      message:         card.qr_code,
      format:          'PKBarcodeFormatQR',
      messageEncoding: 'iso-8859-1',
      altText:         'Votre carte fidélité',
    }],
  });
}

function signManifest(manifestStr, wwdrPem, certPem, keyPem, passphrase) {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifestStr, 'utf8');

  p7.addCertificate(forge.pki.certificateFromPem(wwdrPem));
  const signerCert = forge.pki.certificateFromPem(certPem);
  p7.addCertificate(signerCert);

  const privateKey = passphrase
    ? forge.pki.decryptRsaPrivateKey(keyPem, passphrase)
    : forge.pki.privateKeyFromPem(keyPem);

  p7.addSigner({
    key: privateKey,
    certificate: signerCert,
    digestAlgorithm: forge.pki.oids.sha1,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType,   value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest                              },
      { type: forge.pki.oids.signingTime,   value: new Date()          },
    ],
  });

  p7.sign({ detached: true });
  return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), 'binary');
}

/**
 * Generates a signed .pkpass buffer.
 * Returns null if Apple certificates are not configured via environment variables.
 *
 * Required env vars:
 *   APPLE_WWDR_CERT   — Apple WWDR intermediate certificate (PEM)
 *   APPLE_PASS_CERT   — Pass type certificate (PEM)
 *   APPLE_PASS_KEY    — Private key for the pass certificate (PEM)
 *   APPLE_PASS_KEY_PASSPHRASE — Optional passphrase for the key
 *   APPLE_PASS_TYPE_ID        — e.g. pass.com.yourcompany.loyalty
 *   APPLE_TEAM_ID             — Your 10-character Apple Team ID
 */
async function generatePkpass({ card, customer, merchant }) {
  const wwdrPem  = process.env.APPLE_WWDR_CERT;
  const certPem  = process.env.APPLE_PASS_CERT;
  const keyPem   = process.env.APPLE_PASS_KEY;

  if (!wwdrPem || !certPem || !keyPem) return null;

  const [r, g, b] = hexToRgb(merchant.color);

  // Apple Wallet requires icon.png (29×29) and logo.png (160×50) at minimum
  const files = {
    'icon.png':    solidPng(29,  29,  r, g, b),
    'icon@2x.png': solidPng(58,  58,  r, g, b),
    'logo.png':    solidPng(160, 50,  r, g, b),
    'logo@2x.png': solidPng(320, 100, r, g, b),
    'pass.json':   Buffer.from(buildPassJson({ card, customer, merchant }), 'utf8'),
  };

  const manifest = {};
  for (const [name, buf] of Object.entries(files)) manifest[name] = sha1hex(buf);

  const signature = signManifest(
    JSON.stringify(manifest),
    wwdrPem, certPem, keyPem,
    process.env.APPLE_PASS_KEY_PASSPHRASE || ''
  );

  const zip = new JSZip();
  for (const [name, buf] of Object.entries(files)) zip.file(name, buf);
  zip.file('manifest.json', JSON.stringify(manifest));
  zip.file('signature', signature);

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = { generatePkpass };
