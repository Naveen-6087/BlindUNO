/**
 * Inco Client Utilities
 * 
 * Provides encryption, decryption, and session key management
 * using the @inco/js SDK.
 */

import { Lightning, generateSecp256k1Keypair, type Secp256k1Keypair } from '@inco/js/lite';
import { handleTypes, supportedChains, type HexString } from '@inco/js';
import type { WalletClient } from 'viem';
import { createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { UNO_GAME_ADDRESS } from './constants';

// Chain configuration
const CHAIN_ID = supportedChains.baseSepolia;

// Default session verifier for Inco testnet
const DEFAULT_SESSION_VERIFIER = '0xc34569efc25901bdd6b652164a2c8a7228b23005' as const;

// Session duration: 1 hour
const SESSION_DURATION_MS = 60 * 60 * 1000;

// Initialize Inco Lightning SDK (async)
let zapPromise: Promise<Awaited<ReturnType<typeof Lightning.latest>>> | null = null;

async function getZap() {
  if (!zapPromise) {
    zapPromise = Lightning.latest('testnet', CHAIN_ID);
  }
  return zapPromise;
}

// Create public client for Base Sepolia
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

// Types for session key management - using the actual SDK type
export type IncoKeypair = Secp256k1Keypair;

// Store the raw voucher from the SDK to avoid type issues
export interface IncoSession {
  keypair: IncoKeypair;
  rawVoucher: unknown; // Store the raw voucher object from the SDK
  expiresAt: Date;
}

/**
 * Generate a secp256k1 keypair for session-based decryption
 */
export function createSessionKeypair(): IncoKeypair {
  return generateSecp256k1Keypair();
}

/**
 * Get the address from a keypair's private key
 * This is required by grantSessionKeyAllowanceVoucher
 */
function getAddressFromKeypair(keypair: IncoKeypair): HexString {
  const privateKeyHex = keypair.kp.getPrivate('hex');
  const account = privateKeyToAccount(`0x${privateKeyHex}`);
  return account.address;
}

/**
 * Create a session key allowance voucher
 * This allows subsequent decryption requests without wallet signatures
 */
export async function createSessionVoucher(
  walletClient: WalletClient,
  keypair: IncoKeypair
): Promise<{ rawVoucher: unknown; expiresAt: Date }> {
  const zap = await getZap();
  
  // Calculate expiration
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  
  // Get the grantee address from the keypair's private key (as per docs)
  const granteeAddress = getAddressFromKeypair(keypair);
  
  console.log('Creating session voucher for address:', granteeAddress);
  
  // Grant session key allowance voucher
  const voucher = await zap.grantSessionKeyAllowanceVoucher(
    walletClient as any,
    granteeAddress,
    expiresAt,
    DEFAULT_SESSION_VERIFIER
  );
  
  console.log('Session voucher created successfully');
  
  return {
    rawVoucher: voucher,
    expiresAt,
  };
}

/**
 * Create a full session (keypair + voucher)
 */
export async function createSession(walletClient: WalletClient): Promise<IncoSession> {
  const keypair = createSessionKeypair();
  const { rawVoucher, expiresAt } = await createSessionVoucher(walletClient, keypair);
  
  return {
    keypair,
    rawVoucher,
    expiresAt,
  };
}

/**
 * Encrypt a value for submission to the contract
 */
export async function encryptValue(
  value: bigint,
  accountAddress: HexString,
  handleType: 'euint256' | 'ebool' | 'eaddress' = 'euint256'
): Promise<HexString> {
  const zap = await getZap();
  
  const typeMap = {
    euint256: handleTypes.euint256,
    ebool: handleTypes.ebool,
    eaddress: handleTypes.euint160,
  };
  
  const ciphertext = await zap.encrypt(value, {
    accountAddress,
    dappAddress: UNO_GAME_ADDRESS,
    handleType: typeMap[handleType],
  });
  
  return ciphertext as HexString;
}

/**
 * Encrypt a card ID for playing
 */
export async function encryptCardId(
  cardId: number,
  accountAddress: HexString
): Promise<HexString> {
  return encryptValue(BigInt(cardId), accountAddress, 'euint256');
}

/**
 * Decrypt handles using session key (no wallet signature required)
 */
export async function decryptWithSession(
  session: IncoSession,
  handles: HexString[]
): Promise<bigint[]> {
  const zap = await getZap();
  
  // Use the raw voucher from the session - it has the correct type
  const results = await (zap as any).attestedDecryptWithVoucher(
    session.keypair,
    session.rawVoucher,
    publicClient,
    handles
  );
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return results.map((result: any) => BigInt(result.plaintext.value));
}

/**
 * Decrypt handles using wallet signature (fallback when no session)
 */
export async function decryptWithWallet(
  walletClient: WalletClient,
  handles: HexString[]
): Promise<bigint[]> {
  const zap = await getZap();
  
  const results = await zap.attestedDecrypt(
    walletClient as any,
    handles
  );
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return results.map((result: any) => BigInt(result.plaintext.value));
}

/**
 * Decrypt a single handle (convenience function)
 */
export async function decryptHandle(
  handle: HexString,
  session: IncoSession | null,
  walletClient: WalletClient | null
): Promise<bigint | null> {
  try {
    if (session && session.expiresAt > new Date()) {
      const results = await decryptWithSession(session, [handle]);
      return results[0] ?? null;
    }
    
    if (walletClient) {
      const results = await decryptWithWallet(walletClient, [handle]);
      return results[0] ?? null;
    }
    
    console.error('No session or wallet available for decryption');
    return null;
  } catch (err) {
    console.error('Decryption failed:', err);
    return null;
  }
}

/**
 * Batch decrypt multiple handles
 */
export async function batchDecrypt(
  handles: HexString[],
  session: IncoSession | null,
  walletClient: WalletClient | null
): Promise<(bigint | null)[]> {
  if (handles.length === 0) return [];
  
  try {
    if (session && session.expiresAt > new Date()) {
      const results = await decryptWithSession(session, handles);
      return results;
    }
    
    if (walletClient) {
      const results = await decryptWithWallet(walletClient, handles);
      return results;
    }
    
    console.error('No session or wallet available for batch decryption');
    return handles.map(() => null);
  } catch (err) {
    console.error('Batch decryption failed:', err);
    return handles.map(() => null);
  }
}

export { CHAIN_ID, DEFAULT_SESSION_VERIFIER, SESSION_DURATION_MS };
