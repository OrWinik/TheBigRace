// app/_layout.jsx
import { Slot } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import ErrorBoundary from '../components/ErrorBoundary';
import { LanguageProvider } from '../i18n';
import { installGlobalHandlers } from '../lib/monitoring';

installGlobalHandlers();

export default function Layout() {
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);

  return (
    <ErrorBoundary>
      <LanguageProvider>
        <View style={styles.container}>
          <Slot />
        </View>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
