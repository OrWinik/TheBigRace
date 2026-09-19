// app/_layout.jsx
import { Rubik_400Regular } from '@expo-google-fonts/rubik/400Regular';
import { Rubik_500Medium } from '@expo-google-fonts/rubik/500Medium';
import { Rubik_600SemiBold } from '@expo-google-fonts/rubik/600SemiBold';
import { Rubik_800ExtraBold } from '@expo-google-fonts/rubik/800ExtraBold';
import { Rubik_900Black } from '@expo-google-fonts/rubik/900Black';
import { useFonts } from 'expo-font';
import { Slot } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { C } from '../constants/theme';
import { LanguageProvider } from '../i18n';

// Hold the splash so the first screen never flashes in the system font.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Layout() {
  const [fontsLoaded, fontError] = useFonts({
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_600SemiBold,
    Rubik_800ExtraBold,
    Rubik_900Black,
  });

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);

  const onLayout = useCallback(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  // If the fonts fail to load we still render — falling back to the system
  // font is ugly, but trapping the player on the splash screen is worse.
  if (!fontsLoaded && !fontError) return null;

  return (
    <LanguageProvider>
      <View style={styles.container} onLayout={onLayout}>
        <StatusBar style="dark" />
        <Slot />
      </View>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.base,
  },
});
