// app/home/index.jsx
import { ResizeMode, Video } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { getAuth } from 'firebase/auth';
import { get, getDatabase, push, ref, set } from 'firebase/database';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from '../../i18n';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  base: '#060e20',
  surfaceLow: '#091328',
  surfaceHigh: '#192540',
  surfaceBright: '#1f2b49',
  outline: '#40485d',
  primary: '#85adff',
  secondary: '#69f6b8',
  danger: '#7f1d1d',
  dangerText: '#f87171',
  onSurface: '#dee5ff',
  onVariant: '#a3aac4',
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// ─── Firebase Storage video URLs ─────────────────────────────────────────────
const BUCKET = 'https://firebasestorage.googleapis.com/v0/b/triptailor-71050.firebasestorage.app/o';
const videoUrl = (filename) => `${BUCKET}/${encodeURIComponent(filename)}?alt=media`;

const VIDEOS = {
  welcome:  { uri: videoUrl('belg_welcome_eng.mov') },
  final:    { uri: videoUrl('belg_final_eng.mov') },
  belg_v1:  { uri: videoUrl('belg_v1.mov') },
  belg_v2:  { uri: videoUrl('belg_v2.mov') },
  belg_v3:  { uri: videoUrl('belg_v3.mov') },
  belg_v4:  { uri: videoUrl('belg_v4.mov') },
  belg_v5:  { uri: videoUrl('belg_v5.mov') },
  belg_v6:  { uri: videoUrl('belg_v6.mov') },
  belg_v7:  { uri: videoUrl('belg_v7.mov') },
  belg_v8:  { uri: videoUrl('belg_v8.mov') },
  belg_v9:  { uri: videoUrl('belg_v9.mov') },
};

// ─── Question definitions ─────────────────────────────────────────────────────
// NOTE: Question titles and text are intentionally kept in English here as
// they are game content (clues/missions), not UI strings. If you want to
// translate the mission content itself, move these into the i18n file per language.

const belgradeQuestions = [
  {
    title: 'Mission 1 – Belgrade 1920',
    question:
      'Welcome to Belgrade from over 100 years ago.\n\nThe city was growing again after wars, with horse carriages in the streets, old markets, and traditional shops.\n\nYou are holding a rare photo — a real picture from the early 1900s, taken right here on Knez Mihailova Street, the heart of the city.\n\nBut time has changed everything: shops, buildings, people… Only careful eyes can spot what stayed the same.\n\nYour mission: Find the exact spot where this old photo was taken. When you find it, recreate the photo — same place, same angle, same feeling.\n\nWrite the name of the location and upload your photo.',
    videos: [VIDEOS.belg_v1],
    images: [require('../../assets/images/belg_p1.jpg')],
    answerType: 'text+photo',
    answers: ['delijska česma', 'delijska cesma', 'delijska fountain', 'delijska'],
  },
  {
    title: 'Mission 2 – Identify the Symbol',
    question:
      'Look at the symbol before you.\n\nThis statue has stood watch over Belgrade for over a century — a naked warrior, arm raised, perched high above the city at Kalemegdan Fortress.\n\nWhat is the name of this famous statue?\n\nWrite its name to continue.',
    videos: [VIDEOS.belg_v2],
    answerType: 'text',
    answers: [
      'pobednik', 'the victor', 'the winner', 'the conqueror',
      'victor of kalemegdan', 'kalemegdan victor', 'belgrade victor statue',
      'monument to victory', 'victory statue of belgrade', 'победник',
      'освајач', 'споменик победе',
    ],
  },
  {
    title: 'Mission 3 – The Tank Mission',
    question:
      'You are standing in front of a military exhibition.\n\nLook carefully at the tanks on display.\n\nHow many tanks are there?\n\nEnter the number to continue.',
    videos: [VIDEOS.belg_v3],
    images: [],
    answerType: 'text',
    answers: ['14', 'fourteen', 'četrnaest', 'четрнаест'],
  },
  {
    title: 'Mission 4 – The Graffiti Mission',
    question:
      'Somewhere on the streets of Belgrade hides a piece of street art — bold, colourful, unmissable once you know where to look.\n\nFind the graffiti.\n\nWhat is its address?\n\nEnter the address and upload a photo of you standing in front of it.',
    videos: [VIDEOS.belg_v4],
    images: [require('../../assets/images/belg_p4.jpg')],
    answerType: 'text+photo',
    answers: [
      'karađorđeva 49', 'karadordeva 49', 'karađorđeva49', 'karadordeva49',
      'karadordjeva 49', '49 karađorđeva',
    ],
  },
  {
    title: 'Mission 5 – The Poet Mission',
    question:
      "Welcome to Skadarlija — Belgrade's bohemian quarter, where poets, artists and dreamers have gathered for centuries.\n\nWatch the video, then channel your inner poet.\n\nRecord a short video of yourself performing — a poem, a song, a toast — anything that captures the spirit of this magical street.",
    videos: [VIDEOS.belg_v5],
    images: [],
    answerType: 'video_upload',
    answers: [],
  },
  {
    title: 'Mission 6 – The Princess Ice Cream',
    question:
      'The Princess awaits you with her frozen treasures.\n\nChoose your favourite flavour from what she offers and write it below.\n\nAvailable flavours: Vanilla, Vanilla & Cherry, Coffee, Caramel, Raspberry, White Chocolate & Strawberry, White Chocolate & Coconut Milk, White Chocolate & Hazelnut, Milk Chocolate & Almond, Two Chocolates, Mascarpone & Blueberry, Pistachio.',
    videos: [VIDEOS.belg_v6],
    images: [],
    answerType: 'text',
    answers: [
      'vanilla', 'vanila', 'vanilla & cherry', 'vanila & višnja', 'vanilla and cherry',
      'coffee', 'kafa', 'caramel', 'karamela', 'raspberry', 'malina',
      'white chocolate & strawberry', 'bela čokolada & jagoda',
      'white chocolate & coconut milk', 'bela čokolada & kokosovo mleko',
      'white chocolate & hazelnut', 'bela čokolada & lešnik',
      'milk chocolate & almond', 'mlečna čokolada & badem',
      'two chocolates', 'dve čokolade',
      'mascarpone & blueberry', 'maskarpone & borovnica',
      'pistachio', 'pistać',
    ],
  },
  {
    title: 'Mission 7 – The Macabre Mission',
    question:
      "The macabre dance is one of the oldest and most haunting traditions in European art — a dance with Death himself.\n\nWatch the video for inspiration.\n\nNow it's your turn: record a short video of your group performing the macabre dance.\n\nBe dramatic. Be bold. Be unforgettable.",
    videos: [VIDEOS.belg_v7],
    images: [],
    answerType: 'video_upload',
    answers: [],
  },
  {
    title: 'Mission 8 – The Chocolate Mission',
    question:
      'You have earned some chocolate.\n\nBut first — where are you headed next?\n\nWatch the video and figure out your next destination.\n\nWrite the name of the next location to continue.',
    videos: [VIDEOS.belg_v8],
    images: [],
    answerType: 'text',
    answers: [
      'saint sava', 'saint sava temple', 'hram svetog save',
      'sveti sava', 'crkva svetog save', 'sava saint',
      'храм светог саве', 'свети сава',
    ],
  },
  {
    title: 'Mission 9 – The Final Mission',
    question:
      'You have made it to the final mission.\n\nInside this sacred place, words echo in many languages — ancient words, timeless words, known to millions across the world.\n\nFind the words. Write them down.\n\nThen upload a photo of you at this final location.',
    videos: [VIDEOS.belg_v9],
    images: [],
    answerType: 'text+photo',
    answers: [
      "אבא דבשמיא יתשקד שמך תתא",
      "Πάτερ ἡμῶν ὁ ἐν",
      "Оче наш, који си на",
      "Pater noster, qui es in",
      "أبانا الذي في السماوات، ليتقدس",
      "Отче наш — Сущий на небесах",
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { t, isRTL } = useTranslation();

  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showGameModal, setShowGameModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);

  const [gameCode, setGameCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');

  const [hasValidCode, setHasValidCode] = useState(false);
  const [codeChecked, setCodeChecked] = useState(false);

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [textAnswer, setTextAnswer] = useState('');
  const [photoUri, setPhotoUri] = useState(null);
  const [videoUri, setVideoUri] = useState(null);
  const [wrongAnswer, setWrongAnswer] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [codeFocused, setCodeFocused] = useState(false);
  const [answerFocused, setAnswerFocused] = useState(false);

  const [startTime, setStartTime] = useState(null);
  const [finalTime, setFinalTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const [welcomeEnded, setWelcomeEnded] = useState(false);
  const [showSkipWelcome, setShowSkipWelcome] = useState(false);
  const [finishVideoEnded, setFinishVideoEnded] = useState(false);
  const [showSkipFinish, setShowSkipFinish] = useState(false);

  const skipWelcomeTimerRef = useRef(null);
  const skipFinishTimerRef = useRef(null);
  const welcomeVideoRef = useRef(null);
  const finishVideoRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  const auth = getAuth();
  const db = getDatabase();
  const user = auth.currentUser;

  const countries = ['Belgrade'];

  const textAlign = isRTL ? { textAlign: 'right' } : {};
  const rowStyle = isRTL ? { flexDirection: 'row-reverse' } : {};

  // ── Check code flag on mount ───────────────────────────────────────────────
  useEffect(() => {
    const checkCodeFlag = async () => {
      if (!user) { setCodeChecked(true); return; }
      try {
        const snap = await get(ref(db, `users/${user.uid}/hasSubmittedCode`));
        const timeSnap = await get(ref(db, `users/${user.uid}/codeSubmittedAt`));
        if (snap.exists() && snap.val() === true && timeSnap.exists()) {
          const age = Date.now() - timeSnap.val();
          if (age < THIRTY_DAYS_MS) {
            const codeSnap = await get(ref(db, `users/${user.uid}/game_code`));
            if (codeSnap.exists()) setGameCode(String(codeSnap.val()));
            setHasValidCode(true);
          } else {
            // Flag expired — clear it
            const codeSnap = await get(ref(db, `users/${user.uid}/game_code`));
            if (codeSnap.exists()) {
              // Find the code node in activation_codes and mark it expired
              const codesSnap = await get(ref(db, 'activation_codes'));
              codesSnap.forEach((child) => {
                if (String(child.val().code) === String(codeSnap.val())) {
                  set(ref(db, `activation_codes/${child.key}/expired`), true);
                }
              });
            }
            await set(ref(db, `users/${user.uid}/hasSubmittedCode`), false);
            await set(ref(db, `users/${user.uid}/codeSubmittedAt`), null);
            await set(ref(db, `users/${user.uid}/game_code`), null);
            setHasValidCode(false);
          }
        } else {
          setHasValidCode(false);
        }
      } catch (e) {
        console.error('Code flag check error:', e);
        setHasValidCode(false);
      } finally {
        setCodeChecked(true);
      }
    };
    checkCodeFlag();
  }, []);

  // ── AppState — pause/resume welcome video ──────────────────────────────────
  useEffect(() => {
    if (!showWelcomeModal || welcomeEnded) return;
    const subscription = AppState.addEventListener('change', async (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      if (!welcomeVideoRef.current) return;
      if (prev === 'active' && nextState.match(/inactive|background/)) {
        await welcomeVideoRef.current.pauseAsync();
      } else if (prev.match(/inactive|background/) && nextState === 'active') {
        if (!welcomeEnded) await welcomeVideoRef.current.playAsync();
      }
    });
    return () => subscription.remove();
  }, [showWelcomeModal, welcomeEnded]);

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let interval;
    if (startTime && showGameModal && finalTime === null) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [startTime, showGameModal, finalTime]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ── Main button ────────────────────────────────────────────────────────────
  const handleMainButton = () => {
    hasValidCode ? setShowCountryModal(true) : setShowCodeModal(true);
  };

  // ── Code validation ────────────────────────────────────────────────────────
  const validateCode = async () => {
    const trimmed = inputCode.trim();
    if (!trimmed) { Alert.alert(t('error'), t('errorEnterCode')); return; }
    setIsValidating(true);
    try {
      // ── Find matching code in activation_codes/ ───────────────────────────
      const codesSnap = await get(ref(db, 'activation_codes'));
      if (!codesSnap.exists()) {
        Alert.alert(t('invalidCode'), t('invalidCodeMsg'));
        return;
      }

      let codeKey = null;
      let codeData = null;
      codesSnap.forEach((child) => {
        if (String(child.val().code) === String(trimmed)) {
          codeKey = child.key;
          codeData = child.val();
        }
      });

      if (!codeKey || !codeData) {
        Alert.alert(t('invalidCode'), t('invalidCodeMsg'));
        return;
      }

      if (codeData.expired === true) {
        Alert.alert(t('invalidCode'), t('codeExpired'));
        return;
      }

      const { tier, email: codeEmail } = codeData;
      const currentEmail = user?.email?.toLowerCase().trim();

      // ── Helper: stamp the 30-day flag onto this user's profile ───────────
      const saveUserFlag = async () => {
        await set(ref(db, `users/${user.uid}/hasSubmittedCode`), true);
        await set(ref(db, `users/${user.uid}/codeSubmittedAt`), Date.now());
        await set(ref(db, `users/${user.uid}/game_code`), trimmed);
      };

      const markCodeUsed = () =>
        set(ref(db, `activation_codes/${codeKey}/used`), true);

      const activateAndProceed = async () => {
        await saveUserFlag();
        setGameCode(trimmed);
        setHasValidCode(true);
        setShowCodeModal(false);
        setShowCountryModal(true);
      };

      // ─────────────────────────────────────────────────────────────────────
      // TIER: 1dev — email must match, single user only
      // ─────────────────────────────────────────────────────────────────────
      if (tier === '1dev') {
        if (currentEmail !== codeEmail?.toLowerCase().trim()) {
          Alert.alert(t('invalidCode'), t('invalidCodeMsg'));
          return;
        }
        await markCodeUsed();
        await activateAndProceed();
        return;
      }

      // ─────────────────────────────────────────────────────────────────────
      // TIER: 2dev (1 primary + 1 extra) or 3dev (1 primary + 3 extra)
      // ─────────────────────────────────────────────────────────────────────
      const maxExtras = tier === '2dev' ? 1 : tier === '4dev' ? 3 : 0;
      const joinedUsers = codeData.joinedUsers
        ? Object.values(codeData.joinedUsers)
        : [];
      const isPrimary = currentEmail === codeEmail?.toLowerCase().trim();

      if (isPrimary) {
        await markCodeUsed();
        await activateAndProceed();
        return;
      }

      // Secondary user — already registered under this code (re-login)
      const alreadyJoined = joinedUsers.some((entry) => entry.uid === user.uid);
      if (alreadyJoined) {
        await activateAndProceed();
        return;
      }

      // Check remaining slots
      if (joinedUsers.length >= maxExtras) {
        Alert.alert(t('invalidCode'), t('codeFull'));
        return;
      }

      // Slot open — register secondary user under the code node
      await push(ref(db, `activation_codes/${codeKey}/joinedUsers`), {
        uid: user.uid,
        email: user.email,
        joinedAt: Date.now(),
      });
      await activateAndProceed();

    } catch (e) {
      console.error('validateCode error:', e);
      Alert.alert(t('error'), t('validateError'));
    } finally {
      setIsValidating(false);
    }
  };

  // ── City selected ──────────────────────────────────────────────────────────
  const selectCountry = (country) => {
    setSelectedCountry(country);
    setShowCountryModal(false);
    setWelcomeEnded(false);
    setShowSkipWelcome(false);
    setShowWelcomeModal(true);
    skipWelcomeTimerRef.current = setTimeout(() => setShowSkipWelcome(true), 5000);
  };

  const handleWelcomeVideoEnd = () => {
    if (skipWelcomeTimerRef.current) clearTimeout(skipWelcomeTimerRef.current);
    setShowSkipWelcome(true);
    setWelcomeEnded(true);
  };

  const handleSkipWelcome = async () => {
    if (skipWelcomeTimerRef.current) clearTimeout(skipWelcomeTimerRef.current);
    if (welcomeVideoRef.current) await welcomeVideoRef.current.pauseAsync();
    setWelcomeEnded(true);
    setShowSkipWelcome(true);
  };

  const handleFinishVideoEnd = () => {
    if (skipFinishTimerRef.current) clearTimeout(skipFinishTimerRef.current);
    setFinishVideoEnded(true);
  };

  const handleSkipFinish = async () => {
    if (skipFinishTimerRef.current) clearTimeout(skipFinishTimerRef.current);
    if (finishVideoRef.current) await finishVideoRef.current.pauseAsync();
    setFinishVideoEnded(true);
  };

  // ── Start Race ─────────────────────────────────────────────────────────────
  const startRace = () => {
    setShowWelcomeModal(false);
    setShowGameModal(true);
    setStartTime(Date.now());
    setFinalTime(null);
    setElapsedTime(0);
    setCurrentQuestion(0);
    resetAnswerState();
  };

  // ── Media pickers ──────────────────────────────────────────────────────────
  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('permissionNeeded'), t('cameraPermission'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images', quality: 0.5, base64: true,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('permissionNeeded'), t('cameraVideoPermission'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'videos', videoMaxDuration: 30,
    });
    if (!result.canceled) setVideoUri(result.assets[0].uri);
  };

  const saveFileToDatabase = async (uri, dbPath) => {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    await set(ref(db, dbPath), base64);
  };

  const resetAnswerState = () => {
    setTextAnswer(''); setPhotoUri(null); setVideoUri(null); setWrongAnswer(false);
  };

  // ── Submit answer ──────────────────────────────────────────────────────────
  const submitAnswer = async () => {
    const q = belgradeQuestions[currentQuestion];
    if (q.answerType === 'text' || q.answerType === 'text+photo') {
      if (q.answers.length > 0) {
        const textOk = q.answers.some(a => a.toLowerCase() === textAnswer.toLowerCase().trim());
        if (!textOk) { setWrongAnswer(true); return; }
      }
    }
    if ((q.answerType === 'photo' || q.answerType === 'text+photo') && !photoUri) {
      Alert.alert(t('photoRequired'), t('photoRequiredMsg')); return;
    }
    if (q.answerType === 'video_upload' && !videoUri) {
      Alert.alert(t('videoRequired'), t('videoRequiredMsg')); return;
    }
    setWrongAnswer(false);
    setIsUploading(true);
    try {
      const qNum = currentQuestion + 1;
      const basePath = `users/${user.uid}/results/answers/q${qNum}`;
      if (photoUri) await saveFileToDatabase(photoUri, `${basePath}/picture`);
      if (videoUri) await saveFileToDatabase(videoUri, `${basePath}/video`);
      if (currentQuestion === belgradeQuestions.length - 1) {
        const stopped = elapsedTime;
        setFinalTime(stopped);
        await saveResults(stopped);
        setShowGameModal(false);
        setFinishVideoEnded(false);
        setShowSkipFinish(false);
        skipFinishTimerRef.current = setTimeout(() => setShowSkipFinish(true), 5000);
        setShowEndModal(true);
      } else {
        setCurrentQuestion(prev => prev + 1);
        resetAnswerState();
      }
    } catch (e) {
      console.error('Upload error:', e);
      Alert.alert(t('uploadFailed'), t('uploadFailedMsg'));
    } finally {
      setIsUploading(false);
    }
  };

  // ── Save results ───────────────────────────────────────────────────────────
  const saveResults = async (time) => {
    if (!user) return;
    try {
      await push(ref(db, `users/${user.uid}/results`), {
        gameCode, country: selectedCountry, time,
        completedAt: Date.now(),
        playedByUserId: user.uid,
        playedByEmail: user.email,
      });
    } catch (e) {
      console.error('Error saving results:', e);
      Alert.alert(t('error'), t('saveError'));
    }
  };

  // ── Exit game ──────────────────────────────────────────────────────────────
  const exitGame = () => {
    Alert.alert(t('exitTitle'), t('exitMessage'), [
      { text: t('stay'), style: 'cancel' },
      { text: t('exitConfirm'), style: 'destructive', onPress: resetAll },
    ]);
  };

  // ── Full reset ─────────────────────────────────────────────────────────────
  const resetAll = () => {
    if (skipWelcomeTimerRef.current) clearTimeout(skipWelcomeTimerRef.current);
    if (skipFinishTimerRef.current) clearTimeout(skipFinishTimerRef.current);
    setShowEndModal(false); setShowCodeModal(false); setShowCountryModal(false);
    setShowWelcomeModal(false); setShowGameModal(false);
    setInputCode(''); setSelectedCountry('');
    setCurrentQuestion(0); resetAnswerState();
    setStartTime(null); setFinalTime(null); setElapsedTime(0);
    setWelcomeEnded(false); setShowSkipWelcome(false);
    setFinishVideoEnded(false); setShowSkipFinish(false);
  };

  // ── Answer input UI ────────────────────────────────────────────────────────
  const renderAnswerSection = (q) => (
    <View>
      {(q.answerType === 'text' || q.answerType === 'text+photo') && (
        <>
          <TextInput
            style={[styles.answerInput, answerFocused && styles.answerInputFocused, textAlign]}
            placeholder={t('enterAnswer')}
            placeholderTextColor={C.outline}
            value={textAnswer}
            onChangeText={(v) => { setTextAnswer(v); setWrongAnswer(false); }}
            onFocus={() => setAnswerFocused(true)}
            onBlur={() => setAnswerFocused(false)}
            textAlign={isRTL ? 'right' : 'left'}
          />
          {wrongAnswer && <Text style={[styles.errorText, textAlign]}>{t('wrongAnswer')}</Text>}
        </>
      )}
      {(q.answerType === 'photo' || q.answerType === 'text+photo') && (
        <View style={styles.mediaCapture}>
          <TouchableOpacity style={styles.captureButton} onPress={pickPhoto}>
            <Text style={styles.captureButtonText}>
              {photoUri ? t('retakePhoto') : t('takePhoto')}
            </Text>
          </TouchableOpacity>
          {photoUri && (
            <Image source={{ uri: photoUri }} style={styles.previewImage} resizeMode="cover" />
          )}
        </View>
      )}
      {q.answerType === 'video_upload' && (
        <View style={styles.mediaCapture}>
          <TouchableOpacity style={styles.captureButton} onPress={pickVideo}>
            <Text style={styles.captureButtonText}>
              {videoUri ? t('rerecordVideo') : t('recordVideo')}
            </Text>
          </TouchableOpacity>
          {videoUri && (
            <Text style={[styles.videoConfirm, textAlign]}>{t('videoReady')}</Text>
          )}
        </View>
      )}
    </View>
  );

  if (!codeChecked) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  // ─── Main render ───────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/LogoT.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={[styles.brandTitle, textAlign]}>THE BIG RACE</Text>
      <Text style={[styles.brandSubtitle, textAlign]}>{t('brandSubtitle')}</Text>

      <TouchableOpacity style={styles.primaryButton} onPress={handleMainButton}>
        <Text style={styles.primaryButtonText}>
          {hasValidCode ? t('startGame') : t('enterCode')}
        </Text>
      </TouchableOpacity>

      {/* ── Code Entry Modal ── */}
      <Modal visible={showCodeModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalHeader, rowStyle]}>
              <Text style={styles.modalTitle}>{t('enterCodeTitle')}</Text>
              <TouchableOpacity onPress={() => { setShowCodeModal(false); setInputCode(''); }}>
                <Text style={styles.modalClose}>X</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSubtext, textAlign]}>{t('enterCodeSubtext')}</Text>
            <Text style={[styles.fieldLabel, textAlign]}>{t('raceCodeLabel')}</Text>
            <TextInput
              style={[styles.codeInput, codeFocused && styles.codeInputFocused]}
              placeholder="e.g. 9999"
              placeholderTextColor={C.outline}
              value={inputCode}
              onChangeText={setInputCode}
              autoCapitalize="none"
              keyboardType="default"
              onFocus={() => setCodeFocused(true)}
              onBlur={() => setCodeFocused(false)}
            />
            <TouchableOpacity
              style={[styles.primaryButton, isValidating && styles.buttonDisabled]}
              onPress={validateCode}
              disabled={isValidating}
            >
              {isValidating
                ? <ActivityIndicator size="small" color={C.base} />
                : <Text style={styles.primaryButtonText}>{t('initialize')}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Country Selection Modal ── */}
      <Modal visible={showCountryModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalHeader, rowStyle]}>
              <Text style={styles.modalTitle}>{t('selectCircuit')}</Text>
              <TouchableOpacity onPress={() => setShowCountryModal(false)}>
                <Text style={styles.modalClose}>X</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSubtext, textAlign]}>{t('selectCircuitSub')}</Text>
            {countries.map((c, i) => (
              <TouchableOpacity key={i} style={[styles.cityButton, rowStyle]} onPress={() => selectCountry(c)}>
                <Text style={styles.cityButtonText}>{c.toUpperCase()}</Text>
                <Text style={styles.cityChevron}>{isRTL ? '‹' : '›'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ── Welcome Video Modal ── */}
      <Modal visible={showWelcomeModal} animationType="fade">
        <View style={styles.videoFullScreen}>
          <Video
            ref={welcomeVideoRef}
            source={VIDEOS.welcome}
            style={styles.fullScreenVideo}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
            onPlaybackStatusUpdate={(status) => {
              if (status.isLoaded && status.didJustFinish) handleWelcomeVideoEnd();
            }}
          />
          {showSkipWelcome && !welcomeEnded && (
            <TouchableOpacity style={styles.skipButton} onPress={handleSkipWelcome}>
              <Text style={styles.skipButtonText}>{t('skip')}</Text>
            </TouchableOpacity>
          )}
          {welcomeEnded && (
            <View style={styles.startRaceContainer}>
              <TouchableOpacity style={styles.startRaceButton} onPress={startRace}>
                <Text style={styles.startRaceButtonText}>{t('startRaceButton')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* ── Game Modal ── */}
      <Modal visible={showGameModal} animationType="slide">
        <View style={styles.gameContainer}>
          <View style={[styles.gameHeader, rowStyle]}>
            <View style={styles.timerContainer}>
              <Text style={styles.timerLabel}>{t('timerLabel')}</Text>
              <Text style={styles.timerText}>{formatTime(elapsedTime)}</Text>
            </View>
            <TouchableOpacity style={styles.exitButton} onPress={exitGame}>
              <Text style={styles.exitButtonText}>{t('exit')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.gameScroll} contentContainerStyle={styles.gameScrollContent}>
            <Text style={[styles.questionNumber, textAlign]}>
              {t('missionLabel')} {currentQuestion + 1} / {belgradeQuestions.length}
            </Text>
            <Text style={[styles.missionTitle, textAlign]}>
              {belgradeQuestions[currentQuestion].title}
            </Text>

            {belgradeQuestions[currentQuestion].videos.map((src, i) => (
              <Video
                key={i} source={src} style={styles.mediaVideo}
                useNativeControls resizeMode={ResizeMode.CONTAIN} shouldPlay={false}
              />
            ))}

            {belgradeQuestions[currentQuestion].images &&
              belgradeQuestions[currentQuestion].images.map((src, i) => (
                <Image key={i} source={src} style={styles.mediaImage} resizeMode="contain" />
              ))}

            <Text style={[styles.questionText, textAlign]}>
              {belgradeQuestions[currentQuestion].question}
            </Text>

            {renderAnswerSection(belgradeQuestions[currentQuestion])}

            {isUploading ? (
              <View style={styles.uploadingContainer}>
                <ActivityIndicator size="large" color={C.primary} />
                <Text style={styles.uploadingText}>{t('savingTelemetry')}</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.primaryButton} onPress={submitAnswer}>
                <Text style={styles.primaryButtonText}>
                  {currentQuestion === belgradeQuestions.length - 1 ? t('finishRace') : t('submit')}
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ── End / Finish Video Modal ── */}
      <Modal visible={showEndModal} animationType="fade">
        <View style={styles.videoFullScreen}>
          {!finishVideoEnded ? (
            <>
              <Video
                ref={finishVideoRef}
                source={VIDEOS.final}
                style={styles.fullScreenVideo}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                onPlaybackStatusUpdate={(status) => {
                  if (status.isLoaded && status.didJustFinish) handleFinishVideoEnd();
                }}
              />
              {showSkipFinish && (
                <TouchableOpacity style={styles.skipButton} onPress={handleSkipFinish}>
                  <Text style={styles.skipButtonText}>{t('skip')}</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={styles.endResultsContainer}>
              <Text style={styles.endTrophy}>*</Text>
              <Text style={[styles.endTitle, textAlign]}>{t('raceComplete')}</Text>
              <Text style={[styles.endCity, textAlign]}>{t('belgradCircuit')}</Text>
              <View style={styles.endTimeCard}>
                <Text style={styles.endTimeLabel}>{t('finalTime')}</Text>
                <Text style={styles.endTimeValue}>{formatTime(finalTime ?? elapsedTime)}</Text>
              </View>
              <TouchableOpacity style={styles.primaryButton} onPress={resetAll}>
                <Text style={styles.primaryButtonText}>{t('backToHome')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  loadingScreen: { flex: 1, backgroundColor: C.base, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: C.base },
  brandTitle: { fontSize: 42, fontWeight: '900', fontStyle: 'italic', color: C.primary, letterSpacing: 2, marginBottom: 6, textAlign: 'left', alignSelf: 'flex-start' },
  brandSubtitle: { fontSize: 11, fontWeight: '700', color: C.onVariant, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 56, alignSelf: 'flex-start' },
  primaryButton: { width: '100%', paddingVertical: 18, borderRadius: 4, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: C.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 8 },
  buttonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: C.base, fontSize: 14, fontWeight: '800', letterSpacing: 3, textTransform: 'uppercase' },
  rulesLink: { marginTop: 4 },
  rulesLinkText: { fontSize: 11, fontWeight: '700', color: C.onVariant, letterSpacing: 3, textTransform: 'uppercase', textDecorationLine: 'underline' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(6,14,32,0.88)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', backgroundColor: C.surfaceLow, borderRadius: 12, padding: 24, borderWidth: 1, borderColor: C.surfaceHigh, shadowColor: C.secondary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 32, elevation: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: C.onSurface, letterSpacing: 3 },
  modalClose: { fontSize: 18, color: C.onVariant, fontWeight: '700' },
  modalSubtext: { fontSize: 13, color: C.onVariant, marginBottom: 20, lineHeight: 20 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: C.onVariant, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 },
  codeInput: { backgroundColor: C.base, borderWidth: 1, borderColor: C.outline, borderRadius: 6, paddingHorizontal: 16, paddingVertical: 14, fontSize: 22, color: C.onSurface, letterSpacing: 6, marginBottom: 20, textAlign: 'center' },
  codeInputFocused: { backgroundColor: C.surfaceBright, borderColor: C.primary },
  rulesScroll: { maxHeight: 300, marginBottom: 8 },
  rulesText: { fontSize: 15, color: C.onVariant, lineHeight: 24 },
  cityButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceHigh, borderRadius: 8, paddingVertical: 18, paddingHorizontal: 20, marginBottom: 10, borderWidth: 1, borderColor: C.secondary },
  cityButtonText: { flex: 1, fontSize: 16, fontWeight: '800', color: C.secondary, letterSpacing: 2 },
  cityChevron: { fontSize: 22, color: C.secondary, fontWeight: '700' },
  videoFullScreen: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  fullScreenVideo: { width: '100%', height: '100%', position: 'absolute' },
  skipButton: { position: 'absolute', top: 55, right: 24, backgroundColor: 'rgba(6,14,32,0.7)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  skipButtonText: { color: C.onSurface, fontSize: 14, fontWeight: '600', letterSpacing: 1 },
  startRaceContainer: { position: 'absolute', bottom: 60, alignSelf: 'center' },
  startRaceButton: { backgroundColor: C.primary, paddingVertical: 18, paddingHorizontal: 50, borderRadius: 4, shadowColor: C.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 20 },
  startRaceButtonText: { color: C.base, fontSize: 16, fontWeight: '800', letterSpacing: 3 },
  gameContainer: { flex: 1, backgroundColor: C.base },
  gameHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 55, paddingHorizontal: 20, paddingBottom: 14, backgroundColor: C.surfaceLow, borderBottomWidth: 1, borderBottomColor: C.surfaceHigh },
  timerContainer: { backgroundColor: C.surfaceHigh, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: C.primary },
  timerLabel: { fontSize: 9, fontWeight: '700', color: C.primary, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 2 },
  timerText: { fontSize: 22, fontWeight: '900', color: C.primary, letterSpacing: 2 },
  exitButton: { backgroundColor: C.danger, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 4, borderWidth: 1, borderColor: C.dangerText },
  exitButtonText: { color: C.dangerText, fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  gameScroll: { flex: 1 },
  gameScrollContent: { padding: 20, paddingBottom: 60 },
  questionNumber: { fontSize: 11, color: C.onVariant, marginBottom: 6, letterSpacing: 3, textTransform: 'uppercase' },
  missionTitle: { fontSize: 22, fontWeight: '900', color: C.primary, marginBottom: 20, letterSpacing: 0.5 },
  mediaVideo: { width: '100%', height: 220, borderRadius: 8, marginBottom: 16, backgroundColor: '#000' },
  mediaImage: { width: '100%', height: 220, borderRadius: 8, marginBottom: 16, backgroundColor: C.surfaceHigh },
  questionText: { fontSize: 15, color: C.onSurface, marginBottom: 24, lineHeight: 24 },
  answerInput: { backgroundColor: C.base, borderWidth: 1, borderColor: C.outline, borderRadius: 6, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: C.onSurface, marginBottom: 10 },
  answerInputFocused: { backgroundColor: C.surfaceBright, borderColor: C.primary },
  errorText: { color: '#ff6b6b', fontSize: 13, marginBottom: 12, letterSpacing: 0.3, fontWeight: '600' },
  mediaCapture: { marginBottom: 16 },
  captureButton: { backgroundColor: C.surfaceHigh, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 6, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: C.outline },
  captureButtonText: { color: C.onSurface, fontSize: 15, fontWeight: '600' },
  previewImage: { width: '100%', height: 200, borderRadius: 8, marginTop: 6 },
  videoConfirm: { color: C.secondary, fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 6, letterSpacing: 1 },
  uploadingContainer: { alignItems: 'center', marginVertical: 24 },
  uploadingText: { color: C.onVariant, fontSize: 11, marginTop: 12, letterSpacing: 3, textTransform: 'uppercase' },
  endResultsContainer: { flex: 1, backgroundColor: C.base, justifyContent: 'center', alignItems: 'center', padding: 32, width: '100%' },
  endTrophy: { fontSize: 72, marginBottom: 16, color: C.secondary },
  endTitle: { fontSize: 32, fontWeight: '900', color: C.onSurface, letterSpacing: 3, marginBottom: 6, textTransform: 'uppercase' },
  endCity: { fontSize: 13, color: C.onVariant, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 36 },
  endTimeCard: { backgroundColor: C.surfaceLow, borderRadius: 8, borderWidth: 1, borderColor: C.secondary, paddingVertical: 20, paddingHorizontal: 40, alignItems: 'center', marginBottom: 36, width: '100%', shadowColor: C.secondary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 24 },
  endTimeLabel: { fontSize: 11, fontWeight: '700', color: C.secondary, letterSpacing: 3, marginBottom: 8, textTransform: 'uppercase' },
  endTimeValue: { fontSize: 44, fontWeight: '900', color: C.secondary, letterSpacing: 2 },
  logo: { width: 200, height: 200, marginBottom: 25 },
});