import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from '../../i18n';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: 'he', label: 'עברית', flag: '\u{1F1EE}\u{1F1F1}' },
  { code: 'sr', label: 'Srpski', flag: '\u{1F1F7}\u{1F1F8}' },
];

const C = {
  base:        '#060e20',
  surfaceLow:  '#091328',
  surfaceHigh: '#192540',
  primary:     '#85adff',
  secondary:   '#69f6b8',
  onSurface:   '#dee5ff',
  onVariant:   '#a3aac4',
};

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
  brandTitle:       { fontSize: 42, fontWeight: '900', fontStyle: 'italic', color: C.primary, letterSpacing: 2, marginBottom: 48 },
  heading:          { fontSize: 13, fontWeight: '700', color: C.onVariant, letterSpacing: 4, marginBottom: 32 },
  langButton:       { flexDirection: 'row', alignItems: 'center', width: '100%', backgroundColor: C.surfaceLow, borderRadius: 10, paddingVertical: 18, paddingHorizontal: 20, marginBottom: 12, borderWidth: 1.5, borderColor: C.surfaceHigh },
  langButtonActive: { borderColor: C.secondary, backgroundColor: C.surfaceHigh },
  flag:             { fontSize: 28, marginRight: 16 },
  langLabel:        { flex: 1, fontSize: 18, fontWeight: '700', color: C.onSurface, letterSpacing: 1 },
  langLabelActive:  { color: C.secondary },
  check:            { fontSize: 20, color: C.secondary, fontWeight: '700' },
  continueButton:   { width: '100%', paddingVertical: 18, borderRadius: 4, backgroundColor: C.primary, alignItems: 'center', marginTop: 28, shadowColor: C.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 8 },
  continueText:     { color: C.base, fontSize: 14, fontWeight: '800', letterSpacing: 3 },
});
