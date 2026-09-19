import { Slot } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { C } from '../../constants/theme';

export default function AuthLayout() {
  return (
    <View style={styles.container}>
      <Slot />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.base,
  },
});
