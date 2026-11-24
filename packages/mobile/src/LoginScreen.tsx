import { useEffect, useState } from 'react';
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
import Svg, { Path } from 'react-native-svg';
import { loginRequest } from './auth-api';
import type { MobileConfig } from './config';
import { clearRememberedEmail, loadRememberedEmail, saveRememberedEmail } from './remembered-user';
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
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const topInset = useTopInset();

  useEffect(() => {
    let alive = true;
    void loadRememberedEmail().then((saved) => {
      if (!alive || !saved) return;
      setEmail((current) => current || saved);
      setRemember(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const toggleRemember = () => {
    setRemember((current) => {
      if (current) void clearRememberedEmail();
      return !current;
    });
  };

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Escribe tu correo y tu contraseña.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const session = await loginRequest(config.target, config.clientKey, email, password);
      if (remember) await saveRememberedEmail(email);
      else await clearRememberedEmail();
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
          <View style={styles.passwordField}>
            <TextInput
              autoComplete="password"
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.muted}
              secureTextEntry={!showPassword}
              style={[styles.input, styles.passwordInput]}
              textContentType="password"
              value={password}
            />
            <Pressable
              accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setShowPassword((current) => !current)}
              style={styles.eye}
            >
              <EyeIcon off={showPassword} />
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: remember }}
            onPress={toggleRemember}
            style={styles.remember}
          >
            <View style={[styles.box, remember && styles.boxOn]}>
              {remember ? <Text style={styles.check}>✓</Text> : null}
            </View>
            <Text style={styles.rememberText}>Recordar usuario</Text>
          </Pressable>

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
  passwordField: {
    justifyContent: 'center',
    marginBottom: 16,
  },
  passwordInput: {
    marginBottom: 0,
    paddingRight: 48,
  },
  eye: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    right: 4,
    top: 0,
    width: 44,
  },
  remember: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  box: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  boxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  check: {
    color: colors.onPrimary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  rememberText: {
    color: colors.text,
    fontSize: 14,
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

function EyeIcon({ off }: { off: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      {off ? (
        <Path
          d="M3.98 8.22A10.48 10.48 0 0 0 1.93 12C3.23 16.34 7.24 19.5 12 19.5c.99 0 1.95-.14 2.86-.4M6.23 6.23A10.45 10.45 0 0 1 12 4.5c4.76 0 8.77 3.16 10.07 7.5a10.52 10.52 0 0 1-4.3 5.77M6.23 6.23 3 3m3.23 3.23 3.65 3.65m7.89 7.89L21 21m-3.23-3.23-3.65-3.65m0 0a3 3 0 1 0-4.24-4.24m4.24 4.24L9.88 9.88"
          stroke={colors.muted}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <>
          <Path
            d="M2.04 12.32a1 1 0 0 1 0-.64C3.42 7.51 7.36 4.5 12 4.5c4.64 0 8.57 3.01 9.96 7.18.07.2.07.43 0 .64C20.58 16.49 16.64 19.5 12 19.5c-4.64 0-8.57-3.01-9.96-7.18Z"
            stroke={colors.muted}
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
            stroke={colors.muted}
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </Svg>
  );
}
