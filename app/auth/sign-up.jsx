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
import LanguagePicker from '../../components/LanguagePicker';
import { BW, C, F, R } from '../../constants/theme';
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

      <LanguagePicker />

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

const styles = StyleSheet.create({
  scrollContainer:  { flex: 1, backgroundColor: C.base },
  scrollContent:    { flexGrow: 1, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 48 },

  topBar:           { flexDirection: 'row', alignItems: 'center', marginBottom: 28, marginTop: 20 },
  topBarDash:       { width: 28, height: 4, backgroundColor: C.accent, marginRight: 12, borderRadius: 2 },
  topBarBrand:      { fontSize: 16, fontFamily: F.display, color: C.onSurface, letterSpacing: 0.5 },

  statusRow:        { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 32 },
  statusDot:        { width: 10, height: 10, borderRadius: 5, backgroundColor: C.gold, borderWidth: 1.5, borderColor: C.outline, marginTop: 4, marginRight: 10 },
  statusText:       { flex: 1, fontSize: 11, fontFamily: F.semi, color: C.onVariant, letterSpacing: 2, lineHeight: 18, textTransform: 'uppercase' },

  card:             { backgroundColor: C.surfaceLow, borderRadius: R.lg, padding: 24, borderWidth: BW.card, borderColor: C.outline, marginBottom: 24 },

  fieldBlock:       { marginBottom: 20 },
  fieldLabel:       { fontSize: 11, fontFamily: F.semi, color: C.onVariant, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 },
  inputRow:         { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceBright, borderRadius: R.md, borderWidth: BW.card, borderColor: C.outline, paddingHorizontal: 14 },
  inputFocused:     { backgroundColor: C.goldSoft, borderColor: C.gold },
  inputInner:       { flex: 1, paddingVertical: 14, fontSize: 14, fontFamily: F.body, color: C.onSurface, letterSpacing: 0.5 },
  eyeButton:        { paddingLeft: 10, paddingVertical: 14 },
  eyeIcon:          { fontSize: 16 },

  errorText:        { color: C.dangerText, fontSize: 13, fontFamily: F.semi, marginBottom: 16, letterSpacing: 0.3 },

  primaryButton:    { width: '100%', paddingVertical: 18, borderRadius: R.md, backgroundColor: C.accent, borderWidth: BW.card, borderColor: C.outline, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  primaryButtonText:{ color: C.onAccent, fontSize: 14, fontFamily: F.bold, letterSpacing: 3, textTransform: 'uppercase' },

  signInRow:        { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' },
  signInPrompt:     { fontSize: 11, fontFamily: F.semi, color: C.onVariant, letterSpacing: 2, textTransform: 'uppercase' },
  signInLink:       { fontSize: 11, fontFamily: F.bold, color: C.accent, letterSpacing: 2, textTransform: 'uppercase' },
});
