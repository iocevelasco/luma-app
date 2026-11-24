import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { loginRequest } from './auth-api';
import type { MobileConfig } from './config';
import { saveSession, type Session } from './session';
import { LumaLogo } from './LumaLogo';
import { useTopInset } from './safe-top';
import { colors } from './theme';
import { forgotPasswordUrl } from './urls';

export function LoginScreen({
  config,
  onLoggedIn,
}: {
  config: MobileConfig;
  onLoggedIn: (session: Session) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const topInset = useTopInset();

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Escribe tu correo y tu contraseña.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const session = await loginRequest(config.target, config.clientKey, email, password);
      await saveSession(session);
      onLoggedIn(session);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos entrar.');
    } finally {
      setPending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />
      <View style={[styles.logo, { top: topInset + 56 }]}>
        <LumaLogo />
      </View>
      <View style={styles.center}>
        <View style={styles.card}>
          <Text style={styles.title}>Entrar</Text>
          <Text style={styles.subtitle}>Accede con tu correo y contraseña.</Text>

          <Text style={styles.label}>Correo electrónico</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="ana@estudio.com"
            placeholderTextColor={colors.muted}
            style={styles.input}
            textContentType="username"
            value={email}
          />

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            autoComplete="password"
          onChangeText={setPassword}
          placeholder="••••••••"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={styles.input}
            textContentType="password"
            value={password}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={pending}
            onPress={() => void submit()}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, pending && styles.buttonDisabled]}
          >
            {pending ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>Entrar</Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL(forgotPasswordUrl(config.target))}
          >
            <Text style={styles.forgot}>¿Has olvidado tu contraseña?</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  logo: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    marginTop: 6,
    marginBottom: 24,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    marginBottom: 12,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    marginTop: 4,
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  forgot: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
});
