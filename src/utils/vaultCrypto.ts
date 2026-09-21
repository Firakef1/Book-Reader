import * as Crypto from 'expo-crypto';

export function decoyPasswordFrom(realPassword: string): string {
  return `${realPassword}.`;
}

export function normalizeRecoveryAnswer(answer: string): string {
  return answer.trim().toLowerCase();
}

export async function createSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashSecret(salt: string, secret: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${secret}`,
  );
}

export async function hashRecoveryAnswer(
  salt: string,
  answer: string,
): Promise<string> {
  return hashSecret(salt, normalizeRecoveryAnswer(answer));
}
