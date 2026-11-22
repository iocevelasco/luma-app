import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppWebView } from './src/AppWebView';
import { isMobileConfig, readConfig } from './src/config';
import { LoginScreen } from './src/LoginScreen';
import { loadSession, type Session } from './src/session';
import { colors } from './src/theme';

export default function App() {
  const [config] = useState(readConfig);
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!isMobileConfig(config)) {
      setSession(null);
      return;
    }
    let cancelled = false;
    loadSession()
      .then((stored) => {
        if (!cancelled) setSession(stored);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      });
    return () => {
      cancelled = true;
    };
  }, [config]);

  if (!isMobileConfig(config)) {
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        <Text style={styles.error}>{config.error}</Text>
      </View>
    );
  }

  if (session === undefined) {
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return <LoginScreen config={config} onLoggedIn={setSession} />;
  }

  return (
    <AppWebView
      target={config.target}
      session={session}
      onSessionEnded={() => setSession(null)}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 24,
  },
  error: {
    color: colors.text,
    fontSize: 16,
    textAlign: 'center',
  },
});
