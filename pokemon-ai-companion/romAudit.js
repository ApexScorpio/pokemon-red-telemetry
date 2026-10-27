'use strict';

// Auditoria READ-ONLY de 100% dos bytes de um ficheiro .gb/.gbc.
// Isto não lê a ROM do emulador nem fornece prova de que o ficheiro auditado
// é o mesmo que o SameBoy carregou. Essa identidade deve ser confirmada à parte.
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const KNOWN_ROM_SIZES = {
  0x00: 32768,
  0x01: 65536,
  0x02: 131072,
  0x03: 262144,
  0x04: 524288,
  0x05: 1048576,
  0x06: 2097152,
  0x07: 4194304,
  0x08: 8388608,
  0x52: 1179648,
  0x53: 1310720,
  0x54: 1572864
};

function auditRomFile(filename) {
  const buffer = fs.readFileSync(filename); // a RAM do PC contém o ficheiro completo
  if (buffer.length < 0x150) throw new Error('Ficheiro demasiado pequeno para uma ROM Game Boy.');
  const bytes = buffer.length;

  let checksum = 0;
  for (let offset = 0x134; offset <= 0x14C; offset++) {
    checksum = (checksum - buffer[offset] - 1) & 0xFF;
  }
  const headerChecksumStored = buffer[0x14D];
  const headerChecksumValid = checksum === headerChecksumStored;

  let globalSum = 0;
  for (let offset = 0; offset < bytes; offset++) {
    if (offset !== 0x14E && offset !== 0x14F) globalSum = (globalSum + buffer[offset]) & 0xFFFF;
  }
  const globalChecksumStored = (buffer[0x14E] << 8) | buffer[0x14F];

  const title = buffer.subarray(0x134, 0x144).toString('latin1')
    .split('\0')[0].replace(/[^\x20-\x7E]/g, '').trim();
  const romSizeCode = buffer[0x148];
  const declaredBytes = KNOWN_ROM_SIZES[romSizeCode] || null;
  return {
    source: 'ROM binary file (read-only), NOT live RetroArch memory',
    file: path.basename(filename),
    title: title || null,
    bytesInFile: bytes,
    bytesScanned: bytes,
    coveragePercentOfFile: 100,
    romBankCountInFile: Math.ceil(bytes / 16384),
    declaredRomSizeBytes: declaredBytes,
    fileSizeMatchesHeader: declaredBytes === null ? null : declaredBytes === bytes,
    headerChecksumValid,
    headerChecksumComputed: checksum,
    headerChecksumStored,
    globalChecksumValid: globalSum === globalChecksumStored,
    globalChecksumComputed: globalSum,
    globalChecksumStored,
    sha256FullFile: crypto.createHash('sha256').update(buffer).digest('hex'),
    provesThisIsTheRomLoadedOnIphone: false
  };
}

if (require.main === module) {
  const filename = process.argv[2];
  if (!filename) {
    console.error('Uso: node romAudit.js <caminho-para-o-teu-ficheiro-ROM.gb>');
    process.exitCode = 2;
  } else {
    try {
      console.log(JSON.stringify(auditRomFile(filename), null, 2));
    } catch (error) {
      console.error('Falha na auditoria da ROM:', error.message);
      process.exitCode = 1;
    }
  }
}

module.exports = { auditRomFile };
