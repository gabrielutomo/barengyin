/**
 * lib/pin-auth.ts
 * 
 * Secure Client-Side PIN Authentication & Vault for Barengyin.
 * Uses standard Web Crypto API (SubtleCrypto):
 * - PBKDF2 with 100,000 iterations for key derivation
 * - AES-GCM (256-bit) with random 12-byte IV for authenticated encryption/decryption
 * - SHA-256 for database pin_hash storage
 */

const STORAGE_KEY = "barengyin_pin_vault";

export interface PinVaultInfo {
  hasVault: boolean;
  coupleName?: string;
  userName?: string;
  emailHint?: string;
}

export interface PinVaultPayload {
  email: string;
  password?: string;
  refreshToken?: string;
  coupleName?: string;
  userName?: string;
}

interface StoredVault {
  ciphertext: string; // base64
  iv: string; // base64
  salt: string; // base64
  coupleName?: string;
  userName?: string;
  emailHint?: string;
  updatedAt: string;
}

// Convert ArrayBuffer to Base64
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 to ArrayBuffer
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generate a SHA-256 hex string for storing in profiles.pin_hash
 */
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`barengyin-salt:${pin}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Derive an AES-GCM 256-bit key from a 4-digit PIN and a salt using PBKDF2
 */
async function deriveKeyFromPin(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const pinBuffer = encoder.encode(pin);

  const baseKey = await crypto.subtle.importKey(
    "raw",
    pinBuffer,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Set up / save the encrypted PIN vault to localStorage
 */
export async function setupPinVault(pin: string, payload: PinVaultPayload): Promise<void> {
  if (typeof window === "undefined") return;

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKeyFromPin(pin, salt);

  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(payload));

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    plaintext
  );

  // Mask email for hint, e.g. "a***@gmail.com"
  let emailHint = "";
  if (payload.email) {
    const parts = payload.email.split("@");
    if (parts.length === 2) {
      const name = parts[0];
      const maskedName = name.length > 2 ? name[0] + "***" + name[name.length - 1] : name + "***";
      emailHint = `${maskedName}@${parts[1]}`;
    } else {
      emailHint = payload.email;
    }
  }

  const vaultData: StoredVault = {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv.buffer),
    salt: bufferToBase64(salt.buffer),
    coupleName: payload.coupleName,
    userName: payload.userName,
    emailHint,
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(vaultData));
}

/**
 * Read public metadata about the vault without requiring the PIN
 */
export function getPinVaultInfo(): PinVaultInfo {
  if (typeof window === "undefined") {
    return { hasVault: false };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { hasVault: false };

    const parsed: StoredVault = JSON.parse(raw);
    if (!parsed.ciphertext || !parsed.iv || !parsed.salt) {
      return { hasVault: false };
    }

    return {
      hasVault: true,
      coupleName: parsed.coupleName,
      userName: parsed.userName,
      emailHint: parsed.emailHint,
    };
  } catch {
    return { hasVault: false };
  }
}

/**
 * Unlock and decrypt the vault with the 4-digit PIN.
 * Throws an Error if the PIN is incorrect (AES-GCM authentication failure).
 */
export async function unlockPinVault(pin: string): Promise<PinVaultPayload> {
  if (typeof window === "undefined") {
    throw new Error("Tidak dapat membaca brankas pada lingkungan server");
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    throw new Error("Brankas PIN belum diatur di perangkat ini");
  }

  const parsed: StoredVault = JSON.parse(raw);
  const salt = new Uint8Array(base64ToBuffer(parsed.salt));
  const iv = new Uint8Array(base64ToBuffer(parsed.iv));
  const ciphertext = base64ToBuffer(parsed.ciphertext);

  const key = await deriveKeyFromPin(pin, salt);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
      },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    const jsonStr = decoder.decode(decryptedBuffer);
    return JSON.parse(jsonStr) as PinVaultPayload;
  } catch {
    throw new Error("PIN Pasangan tidak cocok. Silakan periksa kembali!");
  }
}

/**
 * Remove/delete the PIN vault from this device
 */
export function removePinVault(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
