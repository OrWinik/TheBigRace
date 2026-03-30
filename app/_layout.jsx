// app/_layout.jsx
import { Slot } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LanguageProvider } from '../i18n';

export default function Layout() {
  return (
    <LanguageProvider>
      <View style={styles.container}>
        <Slot />
      </View>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});