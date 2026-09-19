import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BW, C, F, R } from '../../constants/theme';
import { useTranslation } from '../../i18n';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: 'he', label: 'עברית', flag: '\u{1F1EE}\u{1F1F1}' },
  { code: 'sr', label: 'Srpski', flag: '\u{1F1F7}\u{1F1F8}' },
];

export default function LanguageSelectScreen() {
  const { language, setLanguage, t } = useTranslation();
  const router = useRouter();

  const handleSelect = (code) => {
    setLanguage(code);
  };

  const handleContinue = () => {
    router.replace('/auth/sign-in');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.brandTitle}>THE BIG RACE</Text>
      <Text style={styles.heading}>{t('chooseLanguage')}</Text>

      {LANGUAGES.map((lang) => (
        <TouchableOpacity
          key={lang.code}
          style={[styles.langButton, language === lang.code && styles.langButtonActive]}
          onPress={() => handleSelect(lang.code)}
        >
          <Text style={styles.flag}>{lang.flag}</Text>
          <Text style={[styles.langLabel, language === lang.code && styles.langLabelActive]}>
            {lang.label}
          </Text>
          {language === lang.code && <Text style={styles.check}>&#x2713;</Text>}
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
        <Text style={styles.continueText}>{t('continueButton')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: C.base, justifyContent: 'center', alignItems: 'center', padding: 28 },
  brandTitle:       { fontSize: 38, fontFamily: F.display, color: C.onSurface, letterSpacing: 0.5, marginBottom: 40 },
  heading:          { fontSize: 12, fontFamily: F.semi, color: C.blue, letterSpacing: 4, marginBottom: 32, textTransform: 'uppercase' },
  langButton:       { flexDirection: 'row', alignItems: 'center', width: '100%', backgroundColor: C.surfaceLow, borderRadius: R.md, paddingVertical: 18, paddingHorizontal: 20, marginBottom: 12, borderWidth: BW.card, borderColor: C.outline },
  langButtonActive: { backgroundColor: C.gold },
  flag:             { fontSize: 28, marginRight: 16 },
  langLabel:        { flex: 1, fontSize: 18, fontFamily: F.semi, color: C.onSurface, letterSpacing: 0.5 },
  langLabelActive:  { fontFamily: F.bold },
  check:            { fontSize: 20, color: C.onSurface, fontFamily: F.bold },
  continueButton:   { width: '100%', paddingVertical: 18, borderRadius: R.md, backgroundColor: C.accent, borderWidth: BW.card, borderColor: C.outline, alignItems: 'center', marginTop: 28 },
  continueText:     { color: C.onAccent, fontSize: 14, fontFamily: F.bold, letterSpacing: 3 },
});
