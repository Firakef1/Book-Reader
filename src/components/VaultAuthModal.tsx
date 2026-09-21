import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import {
  formatLockoutRemaining,
  useVaultStore,
} from '../store/vaultStore';
import { UnlockedVault } from '../types';

type Mode = 'setup' | 'unlock' | 'recover';

type Props = {
  visible: boolean;
  onClose: () => void;
  onUnlocked: (vault: UnlockedVault) => void;
};

export function VaultAuthModal({ visible, onClose, onUnlocked }: Props) {
  const theme = useAppTheme();
  const isSetup = useVaultStore((s) => s.isSetup);
  const failedAttempts = useVaultStore((s) => s.failedAttempts);
  const recoveryQuestion = useVaultStore((s) => s.recoveryQuestion);
  const setupVault = useVaultStore((s) => s.setupVault);
  const tryUnlock = useVaultStore((s) => s.tryUnlock);
  const recoverPassword = useVaultStore((s) => s.recoverPassword);
  const isLockedOut = useVaultStore((s) => s.isLockedOut);
  const lockoutRemainingMs = useVaultStore((s) => s.lockoutRemainingMs);

  const [mode, setMode] = useState<Mode>('unlock');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lockoutLabel, setLockoutLabel] = useState('');

  useEffect(() => {
    if (!visible) return;
    setPassword('');
    setConfirm('');
    setQuestion('');
    setAnswer('');
    setError('');
    setMode(isSetup ? 'unlock' : 'setup');
  }, [visible, isSetup]);

  useEffect(() => {
    if (!visible) return;
    const tick = () => {
      if (isLockedOut()) {
        setLockoutLabel(formatLockoutRemaining(lockoutRemainingMs()));
      } else {
        setLockoutLabel('');
      }
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [visible, isLockedOut, lockoutRemainingMs, failedAttempts]);

  const showRecoverLink = mode === 'unlock' && isSetup && failedAttempts >= 3;

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      if (mode === 'setup') {
        if (!password) {
          setError('Enter a password.');
          return;
        }
        if (password !== confirm) {
          setError('Passwords do not match.');
          return;
        }
        if (!question.trim() || !answer.trim()) {
          setError('Add a recovery question and answer.');
          return;
        }
        await setupVault({
          password,
          recoveryQuestion: question,
          recoveryAnswer: answer,
        });
        onUnlocked('private');
        onClose();
        return;
      }

      if (mode === 'unlock') {
        if (isLockedOut()) {
          setError(
            `Too many attempts. Try again in ${formatLockoutRemaining(lockoutRemainingMs()) || 'a while'}.`,
          );
          return;
        }
        const result = await tryUnlock(password);
        if (result.ok) {
          onUnlocked(result.vault);
          onClose();
          return;
        }
        if (result.reason === 'locked') {
          setError(
            `Too many attempts. Try again in ${formatLockoutRemaining(lockoutRemainingMs()) || 'a day'}.`,
          );
          return;
        }
        setError('Incorrect password.');
        return;
      }

      // recover
      if (!answer.trim()) {
        setError('Enter your recovery answer.');
        return;
      }
      if (!password) {
        setError('Enter a new password.');
        return;
      }
      if (password !== confirm) {
        setError('Passwords do not match.');
        return;
      }
      const result = await recoverPassword({
        recoveryAnswer: answer,
        newPassword: password,
      });
      if (!result.ok) {
        setError(
          result.reason === 'wrongAnswer'
            ? 'Recovery answer is incorrect.'
            : 'Could not recover password.',
        );
        return;
      }
      onUnlocked('private');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            style={[
              styles.title,
              { color: theme.text, fontFamily: 'Literata_700Bold' },
            ]}
          >
            {mode === 'setup'
              ? 'Create password'
              : mode === 'recover'
                ? 'Recover password'
                : 'Enter password'}
          </Text>
          <Text
            style={{
              color: theme.textSecondary,
              fontFamily: 'SourceSans3_400Regular',
              lineHeight: 20,
              marginBottom: 8,
            }}
          >
            {mode === 'setup'
              ? 'Choose a password and a recovery question in case you forget it.'
              : mode === 'recover'
                ? 'Answer your recovery question, then set a new password.'
                : lockoutLabel
                  ? `Locked. Try again in ${lockoutLabel}.`
                  : 'Enter your password to continue.'}
          </Text>

          {mode === 'setup' ? (
            <>
              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                secure
                theme={theme}
              />
              <Field
                label="Confirm password"
                value={confirm}
                onChangeText={setConfirm}
                secure
                theme={theme}
              />
              <Field
                label="Recovery question"
                value={question}
                onChangeText={setQuestion}
                theme={theme}
                placeholder="e.g. First pet’s name?"
              />
              <Field
                label="Recovery answer"
                value={answer}
                onChangeText={setAnswer}
                secure
                theme={theme}
              />
            </>
          ) : null}

          {mode === 'unlock' ? (
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secure
              theme={theme}
              onSubmitEditing={() => void submit()}
            />
          ) : null}

          {mode === 'recover' ? (
            <>
              <Text
                style={{
                  color: theme.textMuted,
                  fontFamily: 'SourceSans3_400Regular',
                  fontSize: 13,
                  marginBottom: 4,
                }}
              >
                {recoveryQuestion || 'Recovery question'}
              </Text>
              <Field
                label="Your answer"
                value={answer}
                onChangeText={setAnswer}
                secure
                theme={theme}
              />
              <Field
                label="New password"
                value={password}
                onChangeText={setPassword}
                secure
                theme={theme}
              />
              <Field
                label="Confirm new password"
                value={confirm}
                onChangeText={setConfirm}
                secure
                theme={theme}
              />
            </>
          ) : null}

          {error ? (
            <Text
              style={{
                color: '#C45C5C',
                fontFamily: 'SourceSans3_400Regular',
                fontSize: 13,
              }}
            >
              {error}
            </Text>
          ) : null}

          {showRecoverLink ? (
            <Pressable onPress={() => {
              setMode('recover');
              setError('');
              setPassword('');
              setConfirm('');
              setAnswer('');
            }}
            >
              <Text
                style={{
                  color: theme.textSecondary,
                  fontFamily: 'SourceSans3_600SemiBold',
                  fontSize: 13,
                  marginTop: 4,
                }}
              >
                Recover password
              </Text>
            </Pressable>
          ) : null}

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.actionBtn}>
              <Text
                style={{
                  color: theme.textSecondary,
                  fontFamily: 'SourceSans3_600SemiBold',
                }}
              >
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void submit()}
              disabled={busy || (mode === 'unlock' && !!lockoutLabel)}
              style={[
                styles.actionBtn,
                styles.primaryBtn,
                { backgroundColor: theme.accent, opacity: busy ? 0.7 : 1 },
              ]}
            >
              {busy ? (
                <ActivityIndicator color={theme.onAccent} />
              ) : (
                <Text
                  style={{
                    color: theme.onAccent,
                    fontFamily: 'SourceSans3_700Bold',
                  }}
                >
                  {mode === 'setup'
                    ? 'Create'
                    : mode === 'recover'
                      ? 'Reset'
                      : 'Unlock'}
                </Text>
              )}
            </Pressable>
          </View>

          {mode === 'recover' ? (
            <Pressable
              onPress={() => {
                setMode('unlock');
                setError('');
                setPassword('');
                setConfirm('');
                setAnswer('');
              }}
            >
              <Text
                style={{
                  color: theme.textMuted,
                  fontFamily: 'SourceSans3_400Regular',
                  fontSize: 13,
                  textAlign: 'center',
                }}
              >
                Back to password
              </Text>
            </Pressable>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  secure,
  theme,
  placeholder,
  onSubmitEditing,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  secure?: boolean;
  theme: ReturnType<typeof useAppTheme>;
  placeholder?: string;
  onSubmitEditing?: () => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{
          color: theme.textMuted,
          fontFamily: 'SourceSans3_600SemiBold',
          fontSize: 11,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={onSubmitEditing}
        style={[
          styles.input,
          {
            backgroundColor: theme.background,
            borderColor: theme.border,
            color: theme.text,
            fontFamily: 'SourceSans3_400Regular',
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 12,
  },
  title: { fontSize: 24 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
    alignItems: 'center',
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    minWidth: 88,
    alignItems: 'center',
  },
  primaryBtn: {},
});
