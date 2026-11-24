import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import WebView, { type WebViewNavigation } from 'react-native-webview';

/**
 * El `.d.ts` de la librería declara `class WebView<P = undefined>`.
 * `WebViewProps & undefined` es `never`, así que el genérico hay que pasarlo.
 */
import { clearRefreshCookie, plantRefreshCookie } from './cookies';
import {
  clearStoredSession,
  isSessionEndedMessage,
  sessionBootstrapScript,
  sessionClearScript,
  type Session,
} from './session';
import { useTopInset } from './safe-top';
import { colors } from './theme';
import { appEntryUrl, isLoginUrl, type WebTarget } from './urls';

export function AppWebView({
  target,
  session,
  onSessionEnded,
}: {
  target: WebTarget;
  session: Session;
  onSessionEnded: () => void;
}) {
  const webRef = useRef<WebView<object>>(null);
  const closing = useRef(false);
  const canGoBack = useRef(false);
  const [ready, setReady] = useState(false);
  const [cookieError, setCookieError] = useState<string | null>(null);
  const topInset = useTopInset();

  useEffect(() => {
    let cancelled = false;
    plantRefreshCookie(target.origin, session.refreshToken)
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setCookieError('No pudimos preparar la sesión en la página.');
      });
    return () => {
      cancelled = true;
    };
  }, [session.refreshToken, target.origin]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack.current) {
        webRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    webRef.current?.injectJavaScript(sessionClearScript());
    void clearRefreshCookie(target.origin).catch(() => undefined);
    void clearStoredSession()
      .catch(() => undefined)
      .finally(onSessionEnded);
  };

  const onNavigation = (nav: WebViewNavigation) => {
    canGoBack.current = nav.canGoBack;
    if (nav.url && isLoginUrl(nav.url, target)) close();
  };

  if (cookieError) {
    return (
      <View style={styles.centered}>
        <StatusBar style="light" />
        <Text style={styles.error}>{cookieError}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.centered}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: topInset }]}>
      <StatusBar style="light" />
      <WebView<object>
        ref={webRef}
        source={{ uri: appEntryUrl(target) }}
        style={styles.web}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        injectedJavaScriptBeforeContentLoaded={sessionBootstrapScript(session)}
        onMessage={(event) => {
          if (isSessionEndedMessage(event.nativeEvent.data)) close();
        }}
        onNavigationStateChange={onNavigation}
        onShouldStartLoadWithRequest={(request) => {
          if (isLoginUrl(request.url, target)) {
            close();
            return false;
          }
          return true;
        }}
        setSupportMultipleWindows={false}
        allowsBackForwardNavigationGestures
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 24,
  },
  web: {
    flex: 1,
    backgroundColor: colors.background,
  },
  error: {
    color: colors.text,
    fontSize: 16,
    textAlign: 'center',
    padding: 24,
  },
});
