import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BW, C, F, R } from '../constants/theme';
import { useTranslation } from '../i18n';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: 'he', label: 'עברית', flag: '\u{1F1EE}\u{1F1F1}' },
  { code: 'sr', label: 'Srpski', flag: '\u{1F1F7}\u{1F1F8}' },
];

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
  trigger:          { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', backgroundColor: C.surfaceLow, paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.pill, borderWidth: BW.thin, borderColor: C.outline, marginBottom: 20 },
  triggerFlag:      { fontSize: 18, marginRight: 8 },
  triggerLabel:     { fontSize: 13, fontFamily: F.semi, color: C.onSurface, letterSpacing: 1 },
  overlay:          { flex: 1, backgroundColor: C.scrim, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card:             { width: '100%', backgroundColor: C.surfaceLow, borderRadius: R.lg, padding: 20, borderWidth: BW.card, borderColor: C.outline },
  option:           { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, borderRadius: R.md, marginBottom: 8, borderWidth: BW.card, borderColor: 'transparent' },
  optionActive:     { borderColor: C.outline, backgroundColor: C.gold },
  optionFlag:       { fontSize: 26, marginRight: 14 },
  optionLabel:      { flex: 1, fontSize: 17, fontFamily: F.semi, color: C.onSurface },
  optionLabelActive:{ fontFamily: F.bold },
  check:            { fontSize: 18, color: C.onSurface, fontFamily: F.bold },
  closeBtn:         { alignSelf: 'center', marginTop: 8, padding: 8 },
  closeBtnText:     { fontSize: 18, color: C.onVariant, fontFamily: F.bold },
});
