import '../global.css';

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AppLaunchSplash } from '@/components/app-launch-splash';
import { useColorScheme } from '@/components/useColorScheme';
import { APP_SPLASH_DELAY_MS } from '@/constants/app-splash';
import { DriverAuthProvider, useDriverAuth } from '@/contexts/driver-auth-context';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  if (!loaded) {
    return null;
  }

  return (
    <DriverAuthProvider>
      <RootLayoutNav />
    </DriverAuthProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isLoggedIn, isLoading } = useDriverAuth();
  const [splashFinished, setSplashFinished] = useState(false);
  const splashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasLoggedInRef = useRef(false);

  const clearSplashTimer = useCallback(() => {
    if (splashTimerRef.current) {
      clearTimeout(splashTimerRef.current);
      splashTimerRef.current = null;
    }
  }, []);

  const scheduleSplashFinish = useCallback(() => {
    if (splashTimerRef.current) {
      return;
    }

    splashTimerRef.current = setTimeout(() => {
      splashTimerRef.current = null;
      setSplashFinished(true);
    }, APP_SPLASH_DELAY_MS);
  }, []);

  const handleSplashVisible = useCallback(() => {
    void SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    const wasLoggedIn = wasLoggedInRef.current;
    wasLoggedInRef.current = isLoggedIn;

    if (!isLoggedIn) {
      clearSplashTimer();

      if (!isLoading) {
        setSplashFinished(true);
        void SplashScreen.hideAsync();
      }

      return;
    }

    if (!wasLoggedIn && isLoggedIn) {
      setSplashFinished((current) => {
        if (!current) {
          return current;
        }

        clearSplashTimer();
        return false;
      });
    }
  }, [clearSplashTimer, isLoggedIn, isLoading]);

  useEffect(() => {
    if (isLoading || !isLoggedIn || splashFinished) {
      return;
    }

    scheduleSplashFinish();
  }, [isLoading, isLoggedIn, scheduleSplashFinish, splashFinished]);

  useEffect(() => () => clearSplashTimer(), [clearSplashTimer]);

  const showLaunchSplash = !splashFinished && (isLoading || isLoggedIn);

  if (showLaunchSplash) {
    return <AppLaunchSplash onVisible={handleSplashVisible} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={isLoggedIn}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: true }} />
          </Stack.Protected>
          <Stack.Protected guard={!isLoggedIn}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
