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
import { BW, C, F, R } from '../../constants/theme';
import { useTranslation } from '../../i18n';

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
          const checkResult = (result) => {
            if (
              result.country &&
              result.country.toLowerCase() === selectedCity.toLowerCase() &&
              typeof result.time === 'number'
            ) {
              if (bestTime === null || result.time < bestTime) bestTime = result.time;
            }
          };
          if (results.races) {
            Object.values(results.races).forEach(checkResult);
          }
          Object.values(results).forEach((val) => {
            if (val && typeof val === 'object' && val.country) checkResult(val);
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
    const isYou    = entry.uid === currentUid;
    const isFirst  = rank === 1 && !isYou;
    const isSecond = rank === 2 && !isYou;
    const isThird  = rank === 3 && !isYou;
    const isTop5   = rank <= 5;

    const rStyle = [
      styles.row,
      isRTL && styles.rowRTL,
      isFirst && styles.rowFirst,
      isSecond && styles.rowPodium,
      isThird && styles.rowPodium,
      isYou   && styles.rowYou,
      !isFirst && !isYou && isTop5 && styles.rowTop5,
    ];

    const rankStyle = [
      styles.rankText,
      isFirst  && styles.rankGold,
      isSecond && styles.rankSilver,
      isThird  && styles.rankBronze,
      isYou    && styles.rankYou,
    ];

    const nameStyle = [
      styles.nameText,
      isFirst && styles.nameGold,
      isYou   && styles.nameYou,
      !isTop5  && styles.nameDim,
    ];

    const timeStyle = [
      styles.timeText,
      isFirst && styles.timeGold,
      isYou   && styles.timeYou,
      !isTop5  && styles.timeDim,
      isRTL && { textAlign: 'left' },
    ];

    return (
      <View key={entry.uid} style={rStyle}>
        {/* Accent bar: flipped side for RTL */}
        {isFirst  && <View style={[styles.accentBarGold,   isRTL && styles.accentBarRight]} />}
        {isSecond && <View style={[styles.accentBarSilver, isRTL && styles.accentBarRight]} />}
        {isThird  && <View style={[styles.accentBarBronze, isRTL && styles.accentBarRight]} />}
        {isYou    && <View style={[styles.accentBarYou,    isRTL && styles.accentBarRight]} />}

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

  feedLabel: { fontSize: 11, fontFamily: F.semi, color: C.accent, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 },
  pageTitle: { fontSize: 36, fontFamily: F.display, color: C.onSurface, letterSpacing: 0.5, marginBottom: 28 },

  citySelectLabel: { fontSize: 10, fontFamily: F.semi, color: C.onVariant, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 },
  cityList:        { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 32 },
  cityPill:        { paddingHorizontal: 16, paddingVertical: 8, borderRadius: R.pill, borderWidth: BW.card, borderColor: C.outline, backgroundColor: C.surfaceLow, marginRight: 8, marginBottom: 8 },
  cityPillActive:  { backgroundColor: C.blue },
  cityPillText:    { fontSize: 11, fontFamily: F.semi, color: C.onSurface, letterSpacing: 2 },
  cityPillTextActive: { color: C.onAccent },

  loadingBlock:  { alignItems: 'center', paddingTop: 60 },
  loadingText:   { fontSize: 11, fontFamily: F.semi, color: C.onVariant, letterSpacing: 3, marginTop: 16 },
  emptyBlock:    { alignItems: 'center', paddingTop: 60 },
  emptyText:     { fontSize: 13, fontFamily: F.bold, color: C.onSurface, letterSpacing: 2, marginBottom: 8 },
  emptySubtext:  { fontSize: 13, fontFamily: F.body, color: C.onVariant },

  leaderboardBlock: {},

  row:      { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceLow, borderRadius: R.md, borderWidth: BW.card, borderColor: C.outline, paddingVertical: 16, paddingRight: 18, paddingLeft: 18, overflow: 'hidden', marginBottom: 10 },
  rowRTL:   { paddingLeft: 18, paddingRight: 14 },
  rowFirst: { backgroundColor: C.gold, paddingLeft: 14 },
  rowPodium:{ backgroundColor: C.surfaceLow, paddingLeft: 14 },
  rowYou:   { backgroundColor: C.accent, paddingLeft: 14 },
  rowTop5:  { backgroundColor: C.surfaceLow },

  accentBarGold:   { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: C.gold },
  accentBarSilver: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: C.silver },
  accentBarBronze: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: C.bronze },
  accentBarYou:    { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: C.outline },
  accentBarRight:  { left: undefined, right: 0 },

  rankText:   { width: 36, fontSize: 18, fontFamily: F.bold, color: C.onSurface, letterSpacing: 1 },
  rankGold:   { color: C.onSurface },
  rankSilver: { color: C.silver },
  rankBronze: { color: C.bronze },
  rankYou:    { color: C.onAccent },

  nameBlock: { flex: 1, paddingHorizontal: 4, minWidth: 0 },
  nameRow:   { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  nameText:  { fontSize: 15, fontFamily: F.bold, color: C.onSurface, letterSpacing: 0.5 },
  nameGold:  { color: C.onSurface },
  nameYou:   { color: C.onAccent },
  nameDim:   { color: C.onVariant, fontFamily: F.semi, fontSize: 13 },

  youBadge:     { backgroundColor: C.onAccent, paddingHorizontal: 7, paddingVertical: 2, borderRadius: R.xs },
  youBadgeText: { fontSize: 9, fontFamily: F.bold, color: C.accent, letterSpacing: 1 },

  globalRankText: { fontSize: 10, fontFamily: F.semi, color: C.onAccent, letterSpacing: 2, marginTop: 3, textTransform: 'uppercase' },

  timeText:  { fontSize: 17, fontFamily: F.bold, color: C.onSurface, letterSpacing: 0.5, textAlign: 'right', minWidth: 68 },
  timeGold:  { color: C.onSurface },
  timeYou:   { color: C.onAccent },
  timeDim:   { color: C.onVariant, fontSize: 14, fontFamily: F.semi },
});
