import crypto from 'crypto';

// Use environment key, fallback to a local generated secret key if not set
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'local-notebook-ai-default-key-32ch!';
const IV_LENGTH = 16;

export function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  // Ensure key is exactly 32 bytes
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).substring(0, 32));
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(text) {
  if (!text) return null;
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).substring(0, 32));
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('[Crypto] Decryption failed:', error);
    return null;
  }
}
