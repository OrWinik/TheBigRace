// app/home/leaderboard.jsx
import { getAuth } from 'firebase/auth';
import { get, getDatabase, ref } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
  gold:          '#f5c518',
  onSurface:     '#dee5ff',
  onVariant:     '#a3aac4',
  dim:           '#2a3348',
};

const CITIES = ['Belgrade'];

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const padRank = (n) => n.toString().padStart(2, '0');

// ─── Component ────────────────────────────────────────────────────────────────
export default function LeaderboardScreen() {
  const { t, isRTL } = useTranslation();

  const [selectedCity, setSelectedCity] = useState('Belgrade');
  const [entries, setEntries]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [currentUid, setCurrentUid]     = useState(null);

  const textAlign = isRTL ? { textAlign: 'right' } : {};
  const rowStyle  = isRTL ? { flexDirection: 'row-reverse' } : {};

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const auth = getAuth();
        const db   = getDatabase();
        setCurrentUid(auth.currentUser?.uid ?? null);

        const usersSnap = await get(ref(db, 'users'));
        if (!usersSnap.exists()) { setEntries([]); setLoading(false); return; }

        const allEntries = [];

        usersSnap.forEach((userSnap) => {
          const uid      = userSnap.key;
          const userData = userSnap.val();
          const userName = userData.user_name || userData.email || 'UNKNOWN';
          const results  = userData.results;

          if (!results) return;

          let bestTime = null;
          Object.values(results).forEach((result) => {
            if (
              result.country &&
              result.country.toLowerCase() === selectedCity.toLowerCase() &&
              typeof result.time === 'number'
            ) {
              if (bestTime === null || result.time < bestTime) bestTime = result.time;
            }
          });

          if (bestTime !== null) allEntries.push({ uid, userName, time: bestTime });
        });

        allEntries.sort((a, b) => a.time - b.time);
        setEntries(allEntries.slice(0, 10));
      } catch (e) {
        console.error('Leaderboard load error:', e);
        setEntries([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [selectedCity]);

  const renderRow = (entry, index) => {
    const rank    = index + 1;
    const isFirst = rank === 1;
    const isYou   = entry.uid === currentUid;
    const isTop5  = rank <= 5;

    const rStyle = [
      styles.row,
      isRTL && styles.rowRTL,
      isFirst && styles.rowFirst,
      isYou   && styles.rowYou,
      !isFirst && !isYou && isTop5 && styles.rowTop5,
    ];

    const rankStyle = [
      styles.rankText,
      isFirst && styles.rankGold,
      isYou   && styles.rankGreen,
    ];

    const nameStyle = [
      styles.nameText,
      isFirst && styles.nameGold,
      isYou   && styles.nameGreen,
      !isTop5  && styles.nameDim,
    ];

    const timeStyle = [
      styles.timeText,
      isFirst && styles.timeGold,
      isYou   && styles.timeGreen,
      !isTop5  && styles.timeDim,
      isRTL && { textAlign: 'left' },
    ];

    return (
      <View key={entry.uid} style={rStyle}>
        {/* Accent bar: flipped side for RTL */}
        {isFirst && <View style={[styles.accentBarGold,  isRTL && styles.accentBarRight]} />}
        {isYou   && <View style={[styles.accentBarGreen, isRTL && styles.accentBarRight]} />}

        <Text style={rankStyle}>{padRank(rank)}</Text>

        <View style={styles.nameBlock}>
          <View style={[styles.nameRow, rowStyle]}>
            <Text style={nameStyle} numberOfLines={1}>
              {entry.userName.toUpperCase()}
            </Text>
            {isYou && (
              <View style={styles.youBadge}>
                <Text style={styles.youBadgeText}>{t('you')}</Text>
              </View>
            )}
          </View>
          {isYou && (
            <Text style={[styles.globalRankText, textAlign]}>
              {t('globalRankLabel')}: #{index + 1}
            </Text>
          )}
        </View>

        <Text style={timeStyle}>{formatTime(entry.time)}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.feedLabel, textAlign]}>{t('telemetryFeed')}</Text>
        <Text style={[styles.pageTitle, textAlign]}>{t('globalRanking')}</Text>

        {/* ── City selector ── */}
        <Text style={[styles.citySelectLabel, textAlign]}>{t('selectCity')}</Text>
        <View style={[styles.cityList, isRTL && { flexDirection: 'row-reverse' }]}>
          {CITIES.map((city) => (
            <TouchableOpacity
              key={city}
              style={[styles.cityPill, selectedCity === city && styles.cityPillActive]}
              onPress={() => setSelectedCity(city)}
            >
              <Text style={[styles.cityPillText, selectedCity === city && styles.cityPillTextActive]}>
                {city.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Leaderboard ── */}
        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="large" color={C.primary} />
            <Text style={styles.loadingText}>{t('loadingTelemetry')}</Text>
          </View>
        ) : entries.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={[styles.emptyText, textAlign]}>
              {t('noRaceData')} {selectedCity.toUpperCase()}
            </Text>
            <Text style={[styles.emptySubtext, textAlign]}>{t('beFirst')}</Text>
          </View>
        ) : (
          <View style={styles.leaderboardBlock}>
            {entries.map((entry, index) => renderRow(entry, index))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: C.base },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 40 },

  feedLabel: { fontSize: 11, fontWeight: '700', color: C.onVariant, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 },
  pageTitle: { fontSize: 34, fontWeight: '900', color: C.onSurface, letterSpacing: 1, marginBottom: 28 },

  citySelectLabel: { fontSize: 10, fontWeight: '700', color: C.outline, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 },
  cityList:        { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 32 },
  cityPill:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 4, borderWidth: 1, borderColor: C.outline, backgroundColor: 'transparent', marginRight: 8, marginBottom: 8 },
  cityPillActive:  { backgroundColor: C.surfaceHigh, borderColor: C.secondary },
  cityPillText:    { fontSize: 11, fontWeight: '700', color: C.onVariant, letterSpacing: 2 },
  cityPillTextActive: { color: C.secondary },

  loadingBlock:  { alignItems: 'center', paddingTop: 60 },
  loadingText:   { fontSize: 11, color: C.onVariant, letterSpacing: 3, marginTop: 16 },
  emptyBlock:    { alignItems: 'center', paddingTop: 60 },
  emptyText:     { fontSize: 13, fontWeight: '700', color: C.onVariant, letterSpacing: 2, marginBottom: 8 },
  emptySubtext:  { fontSize: 13, color: C.dim },

  leaderboardBlock: {},

  row:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceLow, borderRadius: 8, paddingVertical: 16, paddingRight: 18, paddingLeft: 18, overflow: 'hidden', marginBottom: 12 },
  rowRTL:  { paddingLeft: 18, paddingRight: 14 },
  rowFirst:{ backgroundColor: C.surfaceHigh, paddingLeft: 14 },
  rowYou:  { backgroundColor: C.surfaceBright, paddingLeft: 14 },
  rowTop5: { backgroundColor: C.surfaceLow },

  accentBarGold:  { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: C.gold, borderTopLeftRadius: 8, borderBottomLeftRadius: 8 },
  accentBarGreen: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: C.secondary, borderTopLeftRadius: 8, borderBottomLeftRadius: 8 },
  accentBarRight: { left: undefined, right: 0, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderTopRightRadius: 8, borderBottomRightRadius: 8 },

  rankText:  { width: 36, fontSize: 18, fontWeight: '800', color: C.onVariant, letterSpacing: 1 },
  rankGold:  { color: C.gold },
  rankGreen: { color: C.secondary },

  nameBlock: { flex: 1, paddingLeft: 4 },
  nameRow:   { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  nameText:  { fontSize: 15, fontWeight: '800', color: C.onSurface, letterSpacing: 0.5 },
  nameGold:  { color: C.gold },
  nameGreen: { color: C.secondary },
  nameDim:   { color: C.onVariant, fontWeight: '600', fontSize: 13 },

  youBadge:     { backgroundColor: C.secondary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, marginLeft: 6 },
  youBadgeText: { fontSize: 9, fontWeight: '900', color: C.base, letterSpacing: 1 },

  globalRankText: { fontSize: 10, color: C.onVariant, letterSpacing: 2, marginTop: 3, textTransform: 'uppercase' },

  timeText:  { fontSize: 17, fontWeight: '800', color: C.onSurface, letterSpacing: 1, textAlign: 'right', minWidth: 58 },
  timeGold:  { color: C.gold },
  timeGreen: { color: C.secondary },
  timeDim:   { color: C.onVariant, fontSize: 14, fontWeight: '600' },
});