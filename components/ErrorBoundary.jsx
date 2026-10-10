// components/ErrorBoundary.jsx
// Catches render errors so a broken screen shows a retry button instead of a
// white screen, and logs them as render_error (CRITICAL).
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { errorFields, logCritical } from '../lib/monitoring';

export default class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    logCritical('render_error', {
      ...errorFields(error),
      component_stack: String(info?.componentStack ?? '').slice(0, 1500),
    }, `Screen crashed while rendering: ${error?.message}`);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <TouchableOpacity style={styles.button} onPress={() => this.setState({ hasError: false })}>
          <Text style={styles.buttonText}>TRY AGAIN</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060e20', alignItems: 'center', justifyContent: 'center', padding: 28 },
  title: { color: '#dee5ff', fontSize: 18, fontWeight: '700', marginBottom: 24, textAlign: 'center' },
  button: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 4, backgroundColor: '#85adff' },
  buttonText: { color: '#060e20', fontSize: 14, fontWeight: '800', letterSpacing: 3 },
});
