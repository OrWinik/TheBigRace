import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from '../i18n';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: 'he', label: 'עברית', flag: '\u{1F1EE}\u{1F1F1}' },
  { code: 'sr', label: 'Srpski', flag: '\u{1F1F7}\u{1F1F8}' },
];

const C = {
  base:        '#060e20',
  surfaceLow:  '#091328',
  surfaceHigh: '#192540',
  surfaceBright:'#1f2b49',
  primary:     '#85adff',
  secondary:   '#69f6b8',
  onSurface:   '#dee5ff',
  onVariant:   '#a3aac4',
};

export default function LanguagePicker() {
  const { language, setLanguage } = useTranslation();
  const [visible, setVisible] = useState(false);

  const current = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={() => setVisible(true)}>
        <Text style={styles.triggerFlag}>{current.flag}</Text>
        <Text style={styles.triggerLabel}>{current.label}</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.card}>
            {LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[styles.option, language === lang.code && styles.optionActive]}
                onPress={() => { setLanguage(lang.code); setVisible(false); }}
              >
                <Text style={styles.optionFlag}>{lang.flag}</Text>
                <Text style={[styles.optionLabel, language === lang.code && styles.optionLabelActive]}>
                  {lang.label}
                </Text>
                {language === lang.code && <Text style={styles.check}>&#x2713;</Text>}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setVisible(false)}>
              <Text style={styles.closeBtnText}>&#x2715;</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger:          { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', backgroundColor: 'rgba(25,37,64,0.7)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(133,173,255,0.3)', marginBottom: 20 },
  triggerFlag:      { fontSize: 18, marginRight: 8 },
  triggerLabel:     { fontSize: 13, fontWeight: '700', color: C.onVariant, letterSpacing: 1 },
  overlay:          { flex: 1, backgroundColor: 'rgba(6,14,32,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card:             { width: '100%', backgroundColor: C.surfaceLow, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: C.surfaceHigh },
  option:           { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, borderRadius: 8, marginBottom: 8, borderWidth: 1.5, borderColor: 'transparent' },
  optionActive:     { borderColor: C.secondary, backgroundColor: C.surfaceHigh },
  optionFlag:       { fontSize: 26, marginRight: 14 },
  optionLabel:      { flex: 1, fontSize: 17, fontWeight: '700', color: C.onSurface },
  optionLabelActive:{ color: C.secondary },
  check:            { fontSize: 18, color: C.secondary, fontWeight: '700' },
  closeBtn:         { alignSelf: 'center', marginTop: 8, padding: 8 },
  closeBtnText:     { fontSize: 18, color: C.onVariant, fontWeight: '700' },
});
