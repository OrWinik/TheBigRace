// app/auth/sign-in.jsx
import { useRouter } from 'expo-router';
import { getAuth, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { get, getDatabase, ref } from 'firebase/database';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import LanguagePicker from '../../components/LanguagePicker';
import { BW, C, F, R } from '../../constants/theme';
import { useTranslation } from '../../i18n';

export default function SignInScreen() {
  const { t, isRTL } = useTranslation();

  const [email, setEmail]                             = useState('');
  const [password, setPassword]                       = useState('');
  const [showPassword, setShowPassword]               = useState(false);
  const [loading, setLoading]                         = useState(false);
  const [error, setError]                             = useState('');
  const [isModalVisible, setIsModalVisible]           = useState(false);
  const [emailForgotPassword, setEmailForgotPassword] = useState('');
  const [message, setMessage]                         = useState('');
  const [loadingForgotPassword, setLoadingForgotPassword] = useState(false);
  const [emailFocused, setEmailFocused]               = useState(false);
  const [passwordFocused, setPasswordFocused]         = useState(false);
  const router = useRouter();

  const rowStyle = isRTL ? { flexDirection: 'row-reverse' } : {};
  const textAlign = isRTL ? { textAlign: 'right' } : {};

  const handleSignIn = async () => {
    setLoading(true);
    setError('');
    const auth = getAuth();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await checkFirstTimeLogin(userCredential.user);
      setLoading(false);
    } catch (err) {
      setError(t('incorrectCredentials'));
      setLoading(false);
    }
  };

  const checkFirstTimeLogin = async (user) => {
    const database = getDatabase();
    try {
      const userRef = await get(ref(database, `users/${user.uid}/firstTimeLogIn`));
      router.replace('/home/');
    } catch (err) {
      console.error('Error checking first-time login:', err.message);
      router.replace('/home/');
    }
  };

  const handleForgotPassword = () => setIsModalVisible(true);
  const handleCloseModal     = () => { setIsModalVisible(false); setMessage(''); };

  const handleResetPassword = async () => {
    setLoadingForgotPassword(true);
    setMessage('');
    try {
      const auth = getAuth();
      await sendPasswordResetEmail(auth, emailForgotPassword);
      setMessage(t('resetLinkSent'));
      setEmailForgotPassword('');
    } catch {
      setMessage(t('invalidEmail'));
    } finally {
      setLoadingForgotPassword(false);
    }
  };

  const moveToSignUp = () => router.replace('/auth/sign-up');

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      style={styles.scrollContainer}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Header ── */}
      <View style={styles.headerBlock}>
        <Text style={styles.brandTitle}>THE BIG RACE</Text>
      </View>

      <LanguagePicker />

      {/* ── Auth Card ── */}
      <View style={styles.card}>
        <Text style={[styles.cardHeading, textAlign]}>{t('login')}</Text>
        <Text style={[styles.cardSubheading, textAlign]}>{t('loginSubheading')}</Text>

        {/* Email */}
        <View style={styles.fieldBlock}>
          <Text style={[styles.fieldLabel, textAlign]}>{t('emailAddress')}</Text>
          <TextInput
            style={[styles.input, emailFocused && styles.inputFocused, textAlign]}
            placeholder="you@gmail.com"
            placeholderTextColor={C.onVariant}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            textAlign={isRTL ? 'right' : 'left'}
          />
        </View>

        {/* Password */}
        <View style={styles.fieldBlock}>
          <Text style={[styles.fieldLabel, textAlign]}>{t('password')}</Text>
          <View style={[styles.inputRow, passwordFocused && styles.inputFocused, rowStyle]}>
            <TextInput
              style={[styles.inputInner, textAlign]}
              placeholder="••••••••"
              placeholderTextColor={C.onVariant}
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

        {/* Error */}
        {error ? <Text style={[styles.errorText, textAlign]}>⚠ {error}</Text> : null}

        {/* Forgot password */}
        <TouchableOpacity
          style={[styles.forgotRow, isRTL && { alignSelf: 'flex-start' }]}
          onPress={handleForgotPassword}
        >
          <Text style={styles.forgotText}>{t('forgotPassword')}</Text>
        </TouchableOpacity>

        {/* Sign In button */}
        <TouchableOpacity style={styles.primaryButton} onPress={handleSignIn} disabled={loading}>
          {loading
            ? <ActivityIndicator size="small" color={C.onAccent} />
            : <Text style={styles.primaryButtonText}>{t('signInButton')}</Text>
          }
        </TouchableOpacity>

        {/* Sign Up link */}
        <View style={[styles.signUpRow, rowStyle]}>
          <Text style={styles.signUpPrompt}>{t('noAccount')}  </Text>
          <TouchableOpacity onPress={moveToSignUp}>
            <Text style={styles.signUpLink}>{t('signUp')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Forgot Password Modal ── */}
      <Modal visible={isModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>

            <View style={[styles.modalHeader, rowStyle]}>
              <Text style={styles.modalTitle}>{t('resetPassword')}</Text>
              <TouchableOpacity onPress={handleCloseModal} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalBody, textAlign]}>{t('resetPasswordBody')}</Text>

            <Text style={[styles.fieldLabel, textAlign]}>{t('emailAddress')}</Text>
            <TextInput
              style={[styles.input, textAlign]}
              placeholder="you@gmail.com"
              placeholderTextColor={C.onVariant}
              value={emailForgotPassword}
              onChangeText={setEmailForgotPassword}
              autoCapitalize="none"
              keyboardType="email-address"
              textAlign={isRTL ? 'right' : 'left'}
            />

            {message ? (
              <Text style={[
                styles.messageText,
                textAlign,
                message === t('resetLinkSent') ? styles.messageSuccess : styles.messageError,
              ]}>
                {message}
              </Text>
            ) : null}

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleResetPassword}
              disabled={loadingForgotPassword}
            >
              {loadingForgotPassword
                ? <ActivityIndicator size="small" color={C.onAccent} />
                : <Text style={styles.primaryButtonText}>{t('sendResetLink')}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer:  { flex: 1, backgroundColor: C.base },
  scrollContent:    { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 24 },

  headerBlock:      { width: '100%', alignItems: 'flex-start', marginBottom: 40, paddingLeft: 4 },
  brandTitle:       { fontSize: 38, fontFamily: F.display, color: C.onSurface, letterSpacing: 0.5, lineHeight: 44 },

  card:             { width: '100%', backgroundColor: C.surfaceLow, borderRadius: R.lg, padding: 28, borderWidth: BW.card, borderColor: C.outline },
  cardHeading:      { fontSize: 26, fontFamily: F.display, color: C.onSurface, marginBottom: 6, letterSpacing: 0.3 },
  cardSubheading:   { fontSize: 14, fontFamily: F.body, color: C.onVariant, marginBottom: 32, lineHeight: 20 },

  fieldBlock:       { marginBottom: 20 },
  fieldLabel:       { fontSize: 11, fontFamily: F.semi, color: C.onVariant, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 },
  input:            { backgroundColor: C.surfaceBright, borderWidth: BW.card, borderColor: C.outline, borderRadius: R.md, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: F.body, color: C.onSurface },
  inputFocused:     { backgroundColor: C.goldSoft, borderColor: C.gold },
  inputRow:         { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceBright, borderWidth: BW.card, borderColor: C.outline, borderRadius: R.md, paddingHorizontal: 16 },
  inputInner:       { flex: 1, paddingVertical: 14, fontSize: 15, fontFamily: F.body, color: C.onSurface },
  eyeButton:        { paddingLeft: 12, paddingVertical: 14 },
  eyeIcon:          { fontSize: 18 },

  errorText:        { color: C.dangerText, fontSize: 13, fontFamily: F.semi, marginBottom: 8, letterSpacing: 0.3 },

  forgotRow:        { alignSelf: 'flex-end', marginBottom: 28, marginTop: 4 },
  forgotText:       { fontSize: 11, fontFamily: F.semi, color: C.onVariant, letterSpacing: 3, textTransform: 'uppercase' },

  primaryButton:    { width: '100%', paddingVertical: 17, borderRadius: R.md, backgroundColor: C.accent, borderWidth: BW.card, borderColor: C.outline, alignItems: 'center', justifyContent: 'center', marginBottom: 24, marginTop: 15 },
  primaryButtonText:{ color: C.onAccent, fontSize: 15, fontFamily: F.bold, letterSpacing: 3, textTransform: 'uppercase' },

  signUpRow:        { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  signUpPrompt:     { fontSize: 14, fontFamily: F.body, color: C.onVariant },
  signUpLink:       { fontSize: 14, fontFamily: F.bold, color: C.accent },

  modalOverlay:     { flex: 1, backgroundColor: C.scrim, justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard:        { width: '100%', backgroundColor: C.surfaceLow, borderRadius: R.lg, padding: 28, borderWidth: BW.card, borderColor: C.outline },
  modalHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle:       { fontSize: 20, fontFamily: F.display, color: C.onSurface, letterSpacing: 0.3 },
  closeButton:      { padding: 4 },
  closeButtonText:  { fontSize: 18, color: C.onVariant, fontFamily: F.bold },
  modalBody:        { fontSize: 14, fontFamily: F.body, color: C.onVariant, marginBottom: 24, lineHeight: 20 },
  messageText:      { fontSize: 13, fontFamily: F.semi, marginTop: 12, marginBottom: 8, letterSpacing: 0.3 },
  messageSuccess:   { color: C.success },
  messageError:     { color: C.dangerText },
});
