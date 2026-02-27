import { x25519 } from "@noble/curves/ed25519";
import { xchacha20poly1305 } from "@noble/ciphers/chacha";
import { hkdf } from "@noble/hashes/hkdf";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha2";
import type {
  CipherEnvelope,
  ClientCommand,
  ConnectionConfig,
  HelloAck,
  HelloRequest,
} from "./types";

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

export type HandshakeState = {
  privateKey: Uint8Array;
  clientKeyB64: string;
  hello: HelloRequest;
};

export function createHandshake(config: ConnectionConfig): HandshakeState {
  const privateKey = x25519.utils.randomPrivateKey();
  const publicKey = x25519.getPublicKey(privateKey);
  const clientKeyB64 = bytesToBase64(publicKey);
  const ts = Math.floor(Date.now() / 1000);
  const proofMaterial = `${config.identityId}|${config.devicePk}|${clientKeyB64}|${ts}`;
  const proofBytes = hmac(
    sha256,
    hexToBytes(config.identitySecretHex),
    TEXT_ENCODER.encode(proofMaterial),
  );

  const hello: HelloRequest = {
    type: "hello",
    identityId: config.identityId,
    devicePk: config.devicePk,
    clientKey: clientKeyB64,
    ts,
    proof: bytesToHex(proofBytes),
  };

  return {
    privateKey,
    clientKeyB64,
    hello,
  };
}

export function deriveSessionKey(
  serverKeyB64: string,
  sessionId: string,
  config: ConnectionConfig,
  clientPrivateKey: Uint8Array,
): Uint8Array {
  const serverKey = base64ToBytes(serverKeyB64);
  const shared = x25519.getSharedSecret(clientPrivateKey, serverKey);
  const context = TEXT_ENCODER.encode(`constitute-nvr:${config.identityId}:${sessionId}`);
  return hkdf(
    sha256,
    shared,
    hexToBytes(config.identitySecretHex),
    context,
    32,
  );
}

export function encryptCommand(
  sessionKey: Uint8Array,
  command: ClientCommand,
): CipherEnvelope {
  const nonce = randomBytes(24);
  const plaintext = TEXT_ENCODER.encode(JSON.stringify(command));
  const cipher = xchacha20poly1305(sessionKey, nonce);
  const ciphertext = cipher.encrypt(plaintext);

  return {
    type: "cipher",
    nonce: bytesToBase64(nonce),
    data: bytesToBase64(ciphertext),
  };
}

export function decryptEnvelope(
  sessionKey: Uint8Array,
  envelope: CipherEnvelope,
): unknown {
  const nonce = base64ToBytes(envelope.nonce);
  const ciphertext = base64ToBytes(envelope.data);
  const cipher = xchacha20poly1305(sessionKey, nonce);
  const plaintext = cipher.decrypt(ciphertext);
  return JSON.parse(TEXT_DECODER.decode(plaintext));
}

export function parseHelloAck(raw: string): HelloAck {
  const value = JSON.parse(raw) as HelloAck;
  if (value.type !== "hello_ack") {
    throw new Error("expected hello_ack frame");
  }
  return value;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function hexToBytes(value: string): Uint8Array {
  const hex = value.trim();
  if (hex.length % 2 !== 0) {
    throw new Error("invalid hex length");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error("invalid hex value");
    }
    out[i] = byte;
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomBytes(size: number): Uint8Array {
  const out = new Uint8Array(size);
  crypto.getRandomValues(out);
  return out;
}
