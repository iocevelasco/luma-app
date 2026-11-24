import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppWebView } from './src/AppWebView';
import { isMobileConfig, readConfig } from './src/config';
import { LoginScreen } from './src/LoginScreen';
import type { Session } from './src/session';
import { colors } from './src/theme';

export default function App() {
  const [config] = useState(readConfig);
  const [session, setSession] = useState<Session | null>(null);

  let body;
  if (!isMobileConfig(config)) {
    body = (
      <View style={styles.screen}>
        <StatusBar style="light" />
        <Text style={styles.error}>{config.error}</Text>
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
