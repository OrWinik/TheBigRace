// app/home/profile.jsx
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { deleteUser, getAuth } from 'firebase/auth';
import { get, getDatabase, ref, set } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from '../../i18n';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  base:          '#060e20',
  surfaceLow:    '#091328',
  surfaceHigh:   '#192540',
  surfaceBright: '#1f2b49',
  outline:       '#40485d',
  primary:       '#85adff',
  secondary:     '#69f6b8',
  danger:        '#7f1d1d',
  dangerText:    '#f87171',
  onSurface:     '#dee5ff',
  onVariant:     '#a3aac4',
};

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'he', label: 'עברית',   flag: '🇮🇱' },
  { code: 'sr', label: 'Srpski',  flag: '🇷🇸' },
];

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatDate = (timestamp) => {
  if (!timestamp) return '—';
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { t, language, setLanguage, isRTL } = useTranslation();

  const [email, setEmail]               = useState('');
  const [username, setUsername]         = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [results, setResults]           = useState([]);

  const [showHistory, setShowHistory]         = useState(false);
  const [showSettings, setShowSettings]       = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const router = useRouter();
  const auth   = getAuth();
  const user   = auth.currentUser;
  const db     = getDatabase();

  // RTL style helper — flips row direction for Hebrew
  const rowStyle = isRTL ? { flexDirection: 'row-reverse' } : {};

  // ── Load user data ──────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [emailSnap, usernameSnap, imageSnap, resultsSnap] = await Promise.all([
          get(ref(db, `users/${user.uid}/email`)),
          get(ref(db, `users/${user.uid}/user_name`)),
          get(ref(db, `users/${user.uid}/profileImage`)),
          get(ref(db, `users/${user.uid}/results`)),
        ]);
        if (emailSnap.exists())    setEmail(emailSnap.val());
        if (usernameSnap.exists()) setUsername(usernameSnap.val());
        if (imageSnap.exists())    setProfileImage(imageSnap.val());
        if (resultsSnap.exists()) {
          const raw = resultsSnap.val();
          const list = Object.values(raw).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
          setResults(list);
        }
      } catch (e) {
        console.error('Profile load error:', e);
      }
    };
    load();
  }, []);

  // ── Derived stats ───────────────────────────────────────────────────────────
  const totalRaces = results.length;
  const bestTime   = results.length > 0
    ? Math.min(...results.map(r => r.time).filter(t => typeof t === 'number'))
    : null;

  // ── Profile image picker ────────────────────────────────────────────────────
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('permissionNeeded'), t('permissionMsg'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.2,
      base64: true,
      maxWidth: 300,
      maxHeight: 300,
    });
    if (!result.canceled && result.assets?.[0]?.base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      const sizeInMB = (base64Image.length * 3) / 4 / 1024 / 1024;
      if (sizeInMB > 4) {
        Alert.alert(t('imageTooLarge'), t('imageTooLargeMsg'));
        return;
      }
      await set(ref(db, `users/${user.uid}/profileImage`), base64Image);
      setProfileImage(base64Image);
    }
  };

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleSignOut = () => router.push('/auth/sign-in');

  const handleContactUs = () =>
    Linking.openURL('https://www.happytail-dogs.com/contact').catch(console.error);

  const handleTermsOfUse = () =>
    Linking.openURL('https://firebasestorage.googleapis.com/v0/b/happytails-e6683.firebasestorage.app/o/TermsOfUse.PDF?alt=media&token=10ab2721-240e-4256-97d4-ff27ce97b487')
      .catch(console.error);

  const handleDeleteAccount = async () => {
    if (!user) return;
    try {
      await deleteUser(user);
      router.replace('/auth/sign-in');
    } catch (e) {
      console.error('Error deleting account:', e);
      Alert.alert(t('error'), t('deleteError'));
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar ── */}
        <View style={styles.avatarBlock}>
          <View style={styles.avatarWrapper}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>
                  {username ? username[0].toUpperCase() : '?'}
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.editBadge} onPress={pickImage}>
              <Text style={styles.editBadgeIcon}>✏</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.usernameText}>
            {username ? username.toUpperCase() : '—'}
          </Text>
          <Text style={styles.emailText}>
            {email ? email.toUpperCase() : '—'}
          </Text>
        </View>

        {/* ── Stats ── */}
        <View style={styles.statsBlock}>
          <View style={styles.statCard}>
            <View style={styles.statAccentBlue} />
            <View style={styles.statContent}>
              <Text style={styles.statLabel}>{t('totalRaces')}</Text>
              <Text style={styles.statValue}>{totalRaces}</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statAccentGreen} />
            <View style={styles.statContent}>
              <Text style={styles.statLabel}>{t('bestTime')}</Text>
              <Text style={styles.statValue}>
                {bestTime !== null ? formatTime(bestTime) : '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Settings ── */}
        <Text style={[styles.sectionLabel, isRTL && { textAlign: 'right' }]}>
          {t('settings')}
        </Text>

        <View style={styles.secondaryBlock}>
          <TouchableOpacity style={[styles.secondaryRow, rowStyle]} onPress={() => setShowHistory(true)}>
            <Text style={[styles.secondaryLabel, isRTL && { textAlign: 'right' }]}>{t('gameHistory')}</Text>
            <Text style={styles.menuChevron}>{isRTL ? '‹' : '›'}</Text>
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          <TouchableOpacity style={[styles.secondaryRow, rowStyle]} onPress={() => setShowSettings(true)}>
            <Text style={[styles.secondaryLabel, isRTL && { textAlign: 'right' }]}>{t('language')}</Text>
            <Text style={styles.menuChevron}>{isRTL ? '‹' : '›'}</Text>
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          <TouchableOpacity style={[styles.secondaryRow, rowStyle]} onPress={handleContactUs}>
            <Text style={[styles.secondaryLabel, isRTL && { textAlign: 'right' }]}>{t('contactUs')}</Text>
            <Text style={styles.menuChevron}>{isRTL ? '‹' : '›'}</Text>
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          <TouchableOpacity style={[styles.secondaryRow, rowStyle]} onPress={handleTermsOfUse}>
            <Text style={[styles.secondaryLabel, isRTL && { textAlign: 'right' }]}>{t('termsOfUse')}</Text>
            <Text style={styles.menuChevron}>{isRTL ? '‹' : '›'}</Text>
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          <TouchableOpacity style={[styles.secondaryRow, rowStyle]} onPress={() => setShowDeleteModal(true)}>
            <Text style={[styles.secondaryLabel, { color: C.dangerText }, isRTL && { textAlign: 'right' }]}>
              {t('deleteAccount')}
            </Text>
            <Text style={styles.menuChevron}>{isRTL ? '‹' : '›'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Sign Out ── */}
        <TouchableOpacity style={[styles.signOutButton, rowStyle]} onPress={handleSignOut}>
          <Text style={styles.signOutIcon}>{isRTL ? '→]' : '[→'}</Text>
          <Text style={styles.signOutText}>  {t('signOut')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Game History Modal ── */}
      <Modal visible={showHistory} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalHeader, rowStyle]}>
              <Text style={styles.modalTitle}>{t('raceHistory')}</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {results.length === 0 ? (
              <Text style={[styles.emptyText, isRTL && { textAlign: 'right' }]}>{t('noRaces')}</Text>
            ) : (
              <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
                {results.map((r, i) => (
                  <View key={i} style={[styles.historyRow, rowStyle]}>
                    <View>
                      <Text style={[styles.historyCity, isRTL && { textAlign: 'right' }]}>
                        {(r.country || t('unknown')).toUpperCase()}
                      </Text>
                      <Text style={[styles.historyDate, isRTL && { textAlign: 'right' }]}>
                        {formatDate(r.completedAt)}
                      </Text>
                    </View>
                    <Text style={styles.historyTime}>{formatTime(r.time)}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Language Modal ── */}
      <Modal visible={showSettings} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalHeader, rowStyle]}>
              <Text style={styles.modalTitle}>{t('languageTitle')}</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.langRow,
                  rowStyle,
                  language === lang.code && styles.langRowActive,
                ]}
                onPress={() => {
                  setLanguage(lang.code);
                  setShowSettings(false);
                }}
              >
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <Text style={[
                  styles.langLabel,
                  isRTL && { textAlign: 'right' },
                  language === lang.code && styles.langLabelActive,
                ]}>
                  {lang.label}
                </Text>
                {language === lang.code && (
                  <Text style={styles.langCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ── Delete Account Modal ── */}
      <Modal visible={showDeleteModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalHeader, rowStyle]}>
              <Text style={styles.modalTitle}>{t('deleteTitle')}</Text>
              <TouchableOpacity onPress={() => setShowDeleteModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.deleteWarning, isRTL && { textAlign: 'right' }]}>
              {t('deleteWarning')}
            </Text>

            <TouchableOpacity
              style={styles.deleteConfirmButton}
              onPress={handleDeleteAccount}
            >
              <Text style={styles.deleteConfirmText}>{t('deleteConfirm')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowDeleteModal(false)}
            >
              <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: C.base },
  scroll:           { flex: 1 },
  scrollContent:    { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 48 },

  avatarBlock:      { alignItems: 'center', marginBottom: 36 },
  avatarWrapper:    { position: 'relative', marginBottom: 16 },
  avatar:           { width: 100, height: 100, borderRadius: 8, borderWidth: 2, borderColor: C.primary },
  avatarPlaceholder:{ width: 100, height: 100, borderRadius: 8, borderWidth: 2, borderColor: C.primary, backgroundColor: C.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  avatarPlaceholderText: { fontSize: 36, fontWeight: '800', color: C.primary },
  editBadge:        { position: 'absolute', bottom: -8, right: -8, backgroundColor: C.primary, width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  editBadgeIcon:    { fontSize: 13, color: C.base },
  usernameText:     { fontSize: 24, fontWeight: '900', color: C.onSurface, letterSpacing: 2, marginBottom: 4 },
  emailText:        { fontSize: 12, color: C.onVariant, letterSpacing: 2 },

  statsBlock:       { gap: 12, marginBottom: 36 },
  statCard:         { flexDirection: 'row', backgroundColor: C.surfaceLow, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: C.surfaceHigh },
  statAccentBlue:   { width: 4, backgroundColor: C.primary },
  statAccentGreen:  { width: 4, backgroundColor: C.secondary },
  statContent:      { padding: 20 },
  statLabel:        { fontSize: 11, fontWeight: '700', color: C.onVariant, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 },
  statValue:        { fontSize: 36, fontWeight: '900', color: C.onSurface, letterSpacing: 1 },

  sectionLabel:     { fontSize: 11, fontWeight: '700', color: C.onVariant, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 },

  secondaryBlock:   { backgroundColor: C.surfaceLow, borderRadius: 8, borderWidth: 1, borderColor: C.surfaceHigh, marginBottom: 24, overflow: 'hidden' },
  secondaryRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20 },
  secondaryLabel:   { flex: 1, fontSize: 15, color: C.onVariant, fontWeight: '500' },
  menuChevron:      { fontSize: 20, color: C.onVariant },
  menuDivider:      { height: 1, backgroundColor: C.surfaceHigh, marginLeft: 20 },

  signOutButton:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.danger, borderRadius: 8, paddingVertical: 18, borderWidth: 1, borderColor: C.dangerText },
  signOutIcon:      { fontSize: 18, color: C.dangerText, fontWeight: '700' },
  signOutText:      { fontSize: 15, fontWeight: '800', color: C.dangerText, letterSpacing: 3, textTransform: 'uppercase' },

  modalOverlay:     { flex: 1, backgroundColor: 'rgba(6,14,32,0.88)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard:        { width: '100%', backgroundColor: C.surfaceLow, borderRadius: 12, borderWidth: 1, borderColor: C.surfaceHigh, padding: 24, shadowColor: C.secondary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 32, elevation: 12 },
  modalHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:       { fontSize: 16, fontWeight: '800', color: C.onSurface, letterSpacing: 3 },
  modalClose:       { fontSize: 18, color: C.onVariant, fontWeight: '700' },
  emptyText:        { color: C.onVariant, fontSize: 14, textAlign: 'center', paddingVertical: 20 },

  historyList:      { maxHeight: 360 },
  historyRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.surfaceHigh },
  historyCity:      { fontSize: 13, fontWeight: '700', color: C.onSurface, letterSpacing: 1 },
  historyDate:      { fontSize: 11, color: C.onVariant, marginTop: 2, letterSpacing: 1 },
  historyTime:      { fontSize: 16, fontWeight: '800', color: C.primary, letterSpacing: 1 },

  langRow:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.surfaceHigh, borderRadius: 4 },
  langRowActive:    { backgroundColor: C.surfaceHigh },
  langFlag:         { fontSize: 22, marginRight: 14 },
  langLabel:        { flex: 1, fontSize: 16, color: C.onVariant, fontWeight: '500' },
  langLabelActive:  { color: C.secondary, fontWeight: '700' },
  langCheck:        { fontSize: 18, color: C.secondary, fontWeight: '700' },

  deleteWarning:    { fontSize: 14, color: C.onVariant, lineHeight: 22, marginBottom: 24 },
  deleteConfirmButton: { backgroundColor: C.danger, borderWidth: 1, borderColor: C.dangerText, paddingVertical: 16, borderRadius: 6, alignItems: 'center', marginBottom: 12 },
  deleteConfirmText:{ color: C.dangerText, fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  cancelButton:     { paddingVertical: 14, borderRadius: 6, alignItems: 'center', borderWidth: 1, borderColor: C.outline },
  cancelButtonText: { color: C.onVariant, fontSize: 14, fontWeight: '600' },
});