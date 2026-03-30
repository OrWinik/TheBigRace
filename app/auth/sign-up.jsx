// app/auth/sign-up.jsx
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, getAuth, updateProfile } from 'firebase/auth';
import { get, getDatabase, ref, set } from 'firebase/database';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from '../../i18n';

export default function SignUpScreen() {
  const { t, isRTL } = useTranslation();
  const db = getDatabase();

  const [username, setUsername]               = useState('');
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword]       = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [errorMessage, setErrorMessage]       = useState('');

  const [usernameFocused, setUsernameFocused] = useState(false);
  const [emailFocused, setEmailFocused]       = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused]   = useState(false);

  const router = useRouter();

  const rowStyle  = isRTL ? { flexDirection: 'row-reverse' } : {};
  const textAlign = isRTL ? { textAlign: 'right' } : {};

  const handleSignUp = async () => {
    setErrorMessage('');
    if (!username.trim()) {
      setErrorMessage(t('usernameRequired'));
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage(t('passwordsNoMatch'));
      return;
    }
    setLoading(true);
    try {
      const auth = getAuth();
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: username });
      const currentUser = auth.currentUser;
      await set(ref(db, `users/${currentUser.uid}/user_name`), username);
      await set(ref(db, `users/${currentUser.uid}/email`), email);
      setLoading(false);
      await checkFirstTimeLogin(userCredential.user);
    } catch (err) {
      setLoading(false);
      setErrorMessage(t('invalidEmailOrPass'));
    }
  };

  const checkFirstTimeLogin = async (user) => {
    const database = getDatabase();
    try {
      await get(ref(database, `users/${user.uid}/firstTimeLogIn`));
      router.replace('/home/');
    } catch (err) {
      console.error('Error checking first-time login:', err.message);
    }
  };

  const moveToSignIn = () => router.replace('/auth/sign-in');

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Top bar ── */}
      <View style={[styles.topBar, rowStyle]}>
        <View style={styles.topBarDash} />
        <Text style={styles.topBarBrand}>THE BIG RACE</Text>
      </View>

      {/* ── Status line ── */}
      <View style={[styles.statusRow, rowStyle]}>
        <View style={styles.statusDot} />
        <Text style={[styles.statusText, textAlign]}>{t('purchaseEmailNote')}</Text>
      </View>

      {/* ── Form card ── */}
      <View style={styles.card}>

        {/* Username */}
        <View style={styles.fieldBlock}>
          <Text style={[styles.fieldLabel, textAlign]}>{t('usernameLabel')}</Text>
          <View style={[styles.inputRow, usernameFocused && styles.inputFocused, rowStyle]}>
            <TextInput
              style={[styles.inputInner, textAlign]}
              placeholder={isRTL ? 'שם משתמש' : 'username'}
              placeholderTextColor={C.outline}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              onFocus={() => setUsernameFocused(true)}
              onBlur={() => setUsernameFocused(false)}
              textAlign={isRTL ? 'right' : 'left'}
            />
          </View>
        </View>

        {/* Email */}
        <View style={styles.fieldBlock}>
          <Text style={[styles.fieldLabel, textAlign]}>{t('emailTerminal')}</Text>
          <View style={[styles.inputRow, emailFocused && styles.inputFocused, rowStyle]}>
            <TextInput
              style={[styles.inputInner, textAlign]}
              placeholder="you@gmail.com"
              placeholderTextColor={C.outline}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              textAlign={isRTL ? 'right' : 'left'}
            />
          </View>
        </View>

        {/* Password */}
        <View style={styles.fieldBlock}>
          <Text style={[styles.fieldLabel, textAlign]}>{t('passwordLabel')}</Text>
          <View style={[styles.inputRow, passwordFocused && styles.inputFocused, rowStyle]}>
            <TextInput
              style={[styles.inputInner, textAlign]}
              placeholder="••••••••"
              placeholderTextColor={C.outline}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              textAlign={isRTL ? 'right' : 'left'}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
              <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Confirm password */}
        <View style={styles.fieldBlock}>
          <Text style={[styles.fieldLabel, textAlign]}>{t('confirmPassword')}</Text>
          <View style={[styles.inputRow, confirmFocused && styles.inputFocused, rowStyle]}>
            <TextInput
              style={[styles.inputInner, textAlign]}
              placeholder="••••••••"
              placeholderTextColor={C.outline}
              secureTextEntry={!showConfirm}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              onFocus={() => setConfirmFocused(true)}
              onBlur={() => setConfirmFocused(false)}
              textAlign={isRTL ? 'right' : 'left'}
            />
            <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeButton}>
              <Text style={styles.eyeIcon}>{showConfirm ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Error */}
        {errorMessage ? (
          <Text style={[styles.errorText, textAlign]}>⚠ {errorMessage}</Text>
        ) : null}

        {/* Create Account button */}
        <TouchableOpacity style={styles.primaryButton} onPress={handleSignUp} disabled={loading}>
          {loading
            ? <ActivityIndicator size="small" color={C.base} />
            : <Text style={styles.primaryButtonText}>{t('createAccount')}</Text>
          }
        </TouchableOpacity>

        {/* Sign in link */}
        <View style={[styles.signInRow, rowStyle]}>
          <Text style={styles.signInPrompt}>{t('haveAccount')}  </Text>
          <TouchableOpacity onPress={moveToSignIn}>
            <Text style={styles.signInLink}>{t('signInLink')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  base:         '#060e20',
  surfaceLow:   '#091328',
  surfaceHigh:  '#192540',
  surfaceBright:'#1f2b49',
  outline:      '#40485d',
  primary:      '#85adff',
  secondary:    '#69f6b8',
  onSurface:    '#dee5ff',
  onVariant:    '#a3aac4',
};

const styles = StyleSheet.create({
  scrollContainer:  { flex: 1, backgroundColor: C.base },
  scrollContent:    { flexGrow: 1, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 48 },

  topBar:           { flexDirection: 'row', alignItems: 'center', marginBottom: 28, marginTop: 20 },
  topBarDash:       { width: 28, height: 2, backgroundColor: C.secondary, marginRight: 12, borderRadius: 2 },
  topBarBrand:      { fontSize: 16, fontWeight: '800', fontStyle: 'italic', color: C.primary, letterSpacing: 2 },

  statusRow:        { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 32 },
  statusDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: C.secondary, marginTop: 4, marginRight: 10 },
  statusText:       { flex: 1, fontSize: 11, fontWeight: '700', color: C.onVariant, letterSpacing: 2, lineHeight: 18, textTransform: 'uppercase' },

  card:             { backgroundColor: C.surfaceLow, borderRadius: 12, padding: 24, borderWidth: 1, borderColor: C.surfaceHigh, marginBottom: 24 },

  fieldBlock:       { marginBottom: 20 },
  fieldLabel:       { fontSize: 11, fontWeight: '700', color: C.onVariant, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 },
  inputRow:         { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceHigh, borderRadius: 6, borderWidth: 1, borderColor: 'transparent', paddingHorizontal: 14 },
  inputFocused:     { backgroundColor: C.surfaceBright, borderColor: C.primary },
  inputInner:       { flex: 1, paddingVertical: 14, fontSize: 14, color: C.onSurface, letterSpacing: 1 },
  eyeButton:        { paddingLeft: 10, paddingVertical: 14 },
  eyeIcon:          { fontSize: 16 },

  errorText:        { color: '#ff6b6b', fontSize: 13, marginBottom: 16, letterSpacing: 0.3 },

  primaryButton:    { width: '100%', paddingVertical: 18, borderRadius: 4, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 20, shadowColor: C.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 8 },
  primaryButtonText:{ color: C.base, fontSize: 14, fontWeight: '800', letterSpacing: 3, textTransform: 'uppercase' },

  signInRow:        { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' },
  signInPrompt:     { fontSize: 11, fontWeight: '700', color: C.onVariant, letterSpacing: 2, textTransform: 'uppercase' },
  signInLink:       { fontSize: 11, fontWeight: '800', color: C.secondary, letterSpacing: 2, textTransform: 'uppercase' },
});