import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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

  let body;
  if (!isMobileConfig(config)) {
    body = (
      <View style={styles.screen}>
        <StatusBar style="light" />
        <Text style={styles.error}>{config.error}</Text>
      </View>
    );
  } else if (session === undefined) {
    body = (
      <View style={styles.screen}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  } else if (!session) {
    body = <LoginScreen config={config} onLoggedIn={setSession} />;
  } else {
    body = (
      <AppWebView
        target={config.target}
        session={session}
        onSessionEnded={() => setSession(null)}
      />
    );
  }

  return <SafeAreaProvider>{body}</SafeAreaProvider>;
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
