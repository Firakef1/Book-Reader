import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { UnlockedVault } from '../types';
import {
  createSalt,
  decoyPasswordFrom,
  hashRecoveryAnswer,
  hashSecret,
} from '../utils/vaultCrypto';

const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_MS = 24 * 60 * 60 * 1000;

export type VaultUnlockResult =
  | { ok: true; vault: UnlockedVault }
  | { ok: false; reason: 'wrong' | 'locked' | 'notSetup' };

interface VaultPersisted {
  isSetup: boolean;
  salt: string;
  passwordHash: string;
  decoyPasswordHash: string;
  recoveryQuestion: string;
  recoveryAnswerHash: string;
  failedAttempts: number;
  lockedUntil: string | null;
}

interface VaultState extends VaultPersisted {
  hydrated: boolean;
  /** In-memory only — cleared on lock / background. */
  unlockedVault: UnlockedVault | null;
  /** Skip auto-lock while a system picker is open. */
  suspendAutoLock: boolean;
  setHydrated: (value: boolean) => void;
  setSuspendAutoLock: (value: boolean) => void;
  isLockedOut: () => boolean;
  lockoutRemainingMs: () => number;
  setupVault: (input: {
    password: string;
    recoveryQuestion: string;
    recoveryAnswer: string;
  }) => Promise<void>;
  tryUnlock: (password: string) => Promise<VaultUnlockResult>;
  verifyRecoveryAnswer: (answer: string) => Promise<boolean>;
  recoverPassword: (input: {
    recoveryAnswer: string;
    newPassword: string;
  }) => Promise<{ ok: true } | { ok: false; reason: 'wrongAnswer' | 'notSetup' }>;
  lock: () => void;
}

const defaults: VaultPersisted = {
  isSetup: false,
  salt: '',
  passwordHash: '',
  decoyPasswordHash: '',
  recoveryQuestion: '',
  recoveryAnswerHash: '',
  failedAttempts: 0,
  lockedUntil: null,
};

export const useVaultStore = create<VaultState>()(
  persist(
    (set, get) => ({
      ...defaults,
      hydrated: false,
      unlockedVault: null,
      suspendAutoLock: false,
      setHydrated: (value) => set({ hydrated: value }),
      setSuspendAutoLock: (value) => set({ suspendAutoLock: value }),

      isLockedOut: () => {
        const until = get().lockedUntil;
        if (!until) return false;
        return Date.now() < new Date(until).getTime();
      },

      lockoutRemainingMs: () => {
        const until = get().lockedUntil;
        if (!until) return 0;
        return Math.max(0, new Date(until).getTime() - Date.now());
      },

      setupVault: async ({ password, recoveryQuestion, recoveryAnswer }) => {
        const salt = await createSalt();
        const passwordHash = await hashSecret(salt, password);
        const decoyPasswordHash = await hashSecret(
          salt,
          decoyPasswordFrom(password),
        );
        const recoveryAnswerHash = await hashRecoveryAnswer(
          salt,
          recoveryAnswer,
        );
        set({
          isSetup: true,
          salt,
          passwordHash,
          decoyPasswordHash,
          recoveryQuestion: recoveryQuestion.trim(),
          recoveryAnswerHash,
          failedAttempts: 0,
          lockedUntil: null,
          unlockedVault: 'private',
        });
      },

      tryUnlock: async (password) => {
        const state = get();
        if (!state.isSetup) return { ok: false, reason: 'notSetup' };

        if (state.isLockedOut()) {
          return { ok: false, reason: 'locked' };
        }
        // Clear expired lockout timestamp
        if (state.lockedUntil && !state.isLockedOut()) {
          set({ lockedUntil: null, failedAttempts: 0 });
        }

        const hash = await hashSecret(state.salt, password);
        if (hash === state.passwordHash) {
          set({
            failedAttempts: 0,
            lockedUntil: null,
            unlockedVault: 'private',
          });
          return { ok: true, vault: 'private' };
        }
        if (hash === state.decoyPasswordHash) {
          set({
            failedAttempts: 0,
            lockedUntil: null,
            unlockedVault: 'decoy',
          });
          return { ok: true, vault: 'decoy' };
        }

        const failedAttempts = state.failedAttempts + 1;
        if (failedAttempts > MAX_FAILED_ATTEMPTS) {
          set({
            failedAttempts,
            lockedUntil: new Date(Date.now() + LOCKOUT_MS).toISOString(),
            unlockedVault: null,
          });
          return { ok: false, reason: 'locked' };
        }
        set({ failedAttempts, unlockedVault: null });
        return { ok: false, reason: 'wrong' };
      },

      verifyRecoveryAnswer: async (answer) => {
        const state = get();
        if (!state.isSetup) return false;
        const hash = await hashRecoveryAnswer(state.salt, answer);
        return hash === state.recoveryAnswerHash;
      },

      recoverPassword: async ({ recoveryAnswer, newPassword }) => {
        const state = get();
        if (!state.isSetup) return { ok: false, reason: 'notSetup' };
        const answerHash = await hashRecoveryAnswer(
          state.salt,
          recoveryAnswer,
        );
        if (answerHash !== state.recoveryAnswerHash) {
          return { ok: false, reason: 'wrongAnswer' };
        }
        const salt = await createSalt();
        const passwordHash = await hashSecret(salt, newPassword);
        const decoyPasswordHash = await hashSecret(
          salt,
          decoyPasswordFrom(newPassword),
        );
        // Keep the same recovery Q&A (re-hash with new salt)
        const recoveryAnswerHash = await hashRecoveryAnswer(
          salt,
          recoveryAnswer,
        );
        set({
          salt,
          passwordHash,
          decoyPasswordHash,
          recoveryAnswerHash,
          failedAttempts: 0,
          lockedUntil: null,
          unlockedVault: 'private',
        });
        return { ok: true };
      },

      lock: () => set({ unlockedVault: null }),
    }),
    {
      name: 'bookreader-vault',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isSetup: state.isSetup,
        salt: state.salt,
        passwordHash: state.passwordHash,
        decoyPasswordHash: state.decoyPasswordHash,
        recoveryQuestion: state.recoveryQuestion,
        recoveryAnswerHash: state.recoveryAnswerHash,
        failedAttempts: state.failedAttempts,
        lockedUntil: state.lockedUntil,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.unlockedVault = null;
          state.setHydrated(true);
        } else {
          useVaultStore.setState({ hydrated: true, unlockedVault: null });
        }
      },
    },
  ),
);

export function formatLockoutRemaining(ms: number): string {
  if (ms <= 0) return '';
  const totalMin = Math.ceil(ms / 60000);
  if (totalMin < 60) {
    return `${totalMin} minute${totalMin === 1 ? '' : 's'}`;
  }
  const hours = Math.ceil(totalMin / 60);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}
