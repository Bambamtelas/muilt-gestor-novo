import QRCode from 'qrcode';

/**
 * Calculates CRC-16/CCITT-FALSE used in Brazilian PIX BRCode standards
 */
export function crc16(buffer: string): string {
  let crc = 0xffff;
  const polynomial = 0x1021;

  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function emvField(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

export interface PixPayloadOptions {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount?: number;
  txId?: string;
  description?: string;
}

/**
 * Generates an official EMV PIX Copia e Cola payload
 */
export function generatePixPayload({
  pixKey,
  merchantName,
  merchantCity,
  amount,
  txId = '***',
  description,
}: PixPayloadOptions): string {
  // Clean values
  const cleanPixKey = pixKey.trim();
  const cleanName = merchantName.slice(0, 25).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase() || 'COBREFACIL';
  const cleanCity = merchantCity.slice(0, 15).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase() || 'SAO PAULO';
  const cleanTxId = (txId.replace(/[^A-Za-z0-9]/g, '') || 'COBREFACIL').slice(0, 25);

  // Merchant Account Info (GUI + Key + Optional Desc)
  let mai = emvField('00', 'br.gov.bcb.pix');
  mai += emvField('01', cleanPixKey);
  if (description) {
    mai += emvField('02', description.slice(0, 40));
  }

  let payload = '';
  // 00: Payload Format Indicator
  payload += emvField('00', '01');
  // 01: Point of Initiation Method (12 = dynamic, 11 = static)
  payload += emvField('01', amount ? '12' : '11');
  // 26: Merchant Account Information
  payload += emvField('26', mai);
  // 52: Merchant Category Code (0000 = general)
  payload += emvField('52', '0000');
  // 53: Transaction Currency (986 = BRL)
  payload += emvField('53', '986');
  // 54: Transaction Amount
  if (amount && amount > 0) {
    payload += emvField('54', amount.toFixed(2));
  }
  // 58: Country Code
  payload += emvField('58', 'BR');
  // 59: Merchant Name
  payload += emvField('59', cleanName);
  // 60: Merchant City
  payload += emvField('60', cleanCity);
  // 62: Additional Data Field (TxID)
  const addField = emvField('05', cleanTxId);
  payload += emvField('62', addField);

  // 63: CRC16 calculation base
  payload += '6304';
  const checksum = crc16(payload);

  return `${payload}${checksum}`;
}

/**
 * Generates Base64 Data URL for a PIX string
 */
export async function generateQrCodeDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      margin: 2,
      scale: 8,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Failed to generate QR code data URL', err);
    return '';
  }
}
