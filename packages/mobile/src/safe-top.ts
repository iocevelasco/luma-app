import { Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Hueco bajo los iconos del sistema. En Android el WebView arranca en y=0. */
export function useTopInset(): number {
  const insets = useSafeAreaInsets();
  const statusBar = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
  return Math.max(insets.top, statusBar);
}
