// app/home/index.jsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio, ResizeMode, Video } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { getAuth } from 'firebase/auth';
import { get, getDatabase, push, ref, set } from 'firebase/database';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MonitoredVideo from '../../components/MonitoredVideo';
import { useTranslation } from '../../i18n';
import {
  errorFields, logCritical, logError, logEvent, logInfo, logWarning, setContext, Severity,
} from '../../lib/monitoring';
import { prefetchVideo, warmVideoCache } from '../../lib/videoCache';

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

const FEEDBACK_URLS = {
  en: 'https://docs.google.com/forms/d/e/1FAIpQLSeZQ2-l-mTr4UGcF2bRe7bcg0X3sc7B6u3DLSVIgnJRll8SgA/viewform',
  he: 'https://docs.google.com/forms/d/e/1FAIpQLSekUBgEn3zrgUTHYuPwLN3VnCwg4Xs2QItHHQZz6lASMyUQuw/viewform',
  sr: 'https://docs.google.com/forms/d/e/1FAIpQLSebbrk1w2vC_fWJcPAhlnrGPWexpxQSnyXRGUPJK3bw2-pTAw/viewform',
};

// ─── Firebase Storage video URLs ─────────────────────────────────────────────
// 720p / ~1.8 Mbps / faststart re-encodes made by scripts/encode-videos.sh from
// the originals listed in scripts/videos-manifest.json (the originals were
// 1080p @ 19 Mbps, 100–320 MB each, and stalled on cellular data).
const BUCKET = 'https://firebasestorage.googleapis.com/v0/b/triptailor-71050.firebasestorage.app/o';
const videoUrl = (filename) => `${BUCKET}/${encodeURIComponent(filename)}?alt=media`;
const raceVideo = (lang, key) => ({ id: key, uri: videoUrl(`race_v2_${lang}_${key}.mp4`) });

const VIDEO_LANGS = ['en', 'he', 'sr'];
const VIDEO_KEYS = ['welcome', 'final', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9'];
const SHORT_VIDEO_KEYS = ['v5', 'v8', 'final'];

const VIDEOS = Object.fromEntries(VIDEO_LANGS.map((lang) => [
  lang, Object.fromEntries(VIDEO_KEYS.map((key) => [key, raceVideo(lang, key)])),
]));

// Short race overrides for missions 5, 8 and the final video
const SHORT_VIDEOS = Object.fromEntries(VIDEO_LANGS.map((lang) => [
  lang, Object.fromEntries(SHORT_VIDEO_KEYS.map((key) => [key, raceVideo(lang, `short_${key}`)])),
]));

// Falls back to English if a language has no entry
const getVideos = (language) => VIDEOS[language] ?? VIDEOS.en;
const getShortVideoOverrides = (language) => SHORT_VIDEOS[language] ?? SHORT_VIDEOS.en;

const SUPPORT_EMAIL = 'thebigrace11@gmail.com';

const RACE_PROGRESS_KEY = 'race_progress';

const saveRaceProgress = async (state) => {
  try {
    await AsyncStorage.setItem(RACE_PROGRESS_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save race progress:', e);
    logCritical('progress_save_failed', {
      ...errorFields(e), saved_mission: state?.currentQuestion != null ? state.currentQuestion + 1 : null,
    }, 'Could not save race progress to the device');
  }
};

const loadRaceProgress = async () => {
  try {
    const data = await AsyncStorage.getItem(RACE_PROGRESS_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.warn('Failed to load race progress:', e);
    logError('progress_load_failed', errorFields(e), 'Could not read saved race progress');
    return null;
  }
};

const clearRaceProgress = async () => {
  try {
    await AsyncStorage.removeItem(RACE_PROGRESS_KEY);
  } catch (e) {
    console.warn('Failed to clear race progress:', e);
    logWarning('progress_clear_failed', errorFields(e), 'Could not clear saved race progress');
  }
};

// ─── Question definitions ─────────────────────────────────────────────────────
// NOTE: Question titles and text are intentionally kept in English here as
// they are game content (clues/missions), not UI strings. If you want to
// translate the mission content itself, move these into the i18n file per language.

const getBelgradeQuestions = (V, language, raceType) => {
  const q = (en, he, sr) => language === 'he' ? he : language === 'sr' ? sr : en;
  return [
    {
      title: q('Mission 1 – Belgrade 1920', 'משימה 1 – בלגרד 1920', 'Misija 1 – Beograd 1920'),
      question: q(
        'Welcome to Belgrade from over 100 years ago.\n\nThe city was growing again after wars, with horse carriages in the streets, old markets, and traditional shops.\n\nYou are holding a rare photo — a real picture from the early 1900s, taken right here on Knez Mihailova Street, the heart of the city.\n\nBut time has changed everything: shops, buildings, people… Only careful eyes can spot what stayed the same.\n\nYour mission: Find the exact spot where this old photo was taken. When you find it, recreate the photo — same place, same angle, same feeling.\n\nWrite the name of the fountain and upload your photo.',
        'ברוכים הבאים לבלגרד של לפני יותר ממאה שנה.\n\nעיר בתנופה, בנייה מחודשת אחרי מלחמות, רחובות מלאים בעגלות סוסים, חנויות מסורתיות וקולות של שוק עתיק.\n\nבידיכם נמצאת תמונה נדירה — צילום אותנטי מתחילת המאה ה-20, שצולם ממש כאן — ברחוב קנז מיכאילובה, לב העיר מאז ומעולם.\n\nאבל הזמן שחק הכל: חנויות התחלפו, מבנים שופצו, אנשים נעלמו... ורק מי שמביט בעין חדה יצליח לזהות את מה שנשאר בדיוק כפי שהיה.\n\nמשימתכם פשוטה — אך לא קלה:\nעליכם למצוא את המיקום המדויק בו צולמה התמונה לפני מאה שנה.\nאותו רחוב. אותו זווית. אותה נשמה.\n\nכשתמצאו את הנקודה — רשמו את שם המזרקה וצלמו תמונה.',
        'Dobrodošli u Beograd od pre više od sto godina —\ngrad u obnovi nakon ratova,\nsa ulicama punim zaprega, starih radnji i zvukova pijace.\nU vašim rukama je retka fotografija…\nnastala početkom 20. veka u Knez Mihailovoj ulici.\nAli vreme je promenilo sve:\nradnje su nestajale, zgrade su se menjale, ljudi su dolazili i odlazili…\nVaš zadatak je jednostavan, ali ne i lak:\npronađite tačnu lokaciju na kojoj je fotografija snimljena.\nKada je pronađete:\n– zapišite ime česme\n– rekonstruišite fotografiju (isti ugao, ista perspektiva)\n– i snimite današnji Beograd u dijalogu sa prošlošću\nSrećno — istorija vas čeka.'
      ),
      videos: [V.v1],
      images: [require('../../assets/images/belg_p1.jpg')],
      answerType: 'text+photo',
      answers: [
        'delijska česma', 'delijska cesma', 'delijska fountain', 'delijska',
        'fontana', 'turkish fountain', 'turska česma', 'turska cesma',
        'מזרקת דליסקה', 'דליסקה', 'דליסקה פאונטיין', 'פונטנה',
      ],
    },
    {
      title: q('Mission 2 – Identify the Symbol', 'משימה 2 – זהו את הסמל', 'Misija 2 – Prepoznajte simbol'),
      question: q(
        'Look at the symbol before you.\n\nThis statue has stood watch over Belgrade for over a century — a naked warrior, arm raised, perched high above the city at Kalemegdan Fortress.\n\nWhat is the name of this famous statue?\n\nWrite its name and upload a photo of you with the statue.',
        'עליכם למצוא את הדמות הזאת, לרשום את שמה ולהצטלם איתה — כדי להוכיח שהצלחתם לזהות את אחד הסמלים המשמעותיים של בלגרד.\n\nהוא מחזיק חרב — אך אינו יוצא למלחמה.\nהוא עומד זקוף — אך אינו שייך לאף צבא.\nהוא מביט מערבה — כאילו שומר על העיר ונושם את ההיסטוריה שעברה כאן.\n\nמה שם הפסל?\n\nרשמו את שמו.',
        'Bravo! Uspeli ste da rešite prvu zagonetku.\nSada ulazite u Kalemegdan — jedno od najvažnijih istorijskih mesta u Beogradu.\nNa visokoj litici, gde se spajaju Sava i Dunav, stoji simbol grada.\nOn nije kralj ni vojnik, već ideja:\npobeda, sloboda i snaga.\nVaš zadatak:\n– pronađite ga\n– zapišite njegovo ime\n– i fotografišite se sa njim\nSrećno!'
      ),
      videos: [V.v2],
      answerType: 'text+photo',
      answers: [
        'pobednik', 'the victor', 'the winner', 'the conqueror',
        'victor', 'viktor', 'the viktor',
        'victor of kalemegdan', 'kalemegdan victor', 'belgrade victor statue',
        'monument to victory', 'victory statue of belgrade',
        'osvajač',
        'победник', 'освајач', 'споменик победе',
        'победник са калемегдана', 'калемегдански победник',
        'београдски победник', 'статуа победе у београду',
        'פובדניק', 'המנצח', 'הזוכה', 'הכובש',
        'ויקטור', 'פסל ויקטור',
        'פסל ויקטור של קלמגדן', 'ויקטור קלמגדן',
        'פסל ויקטור של בלגרד', 'אנדרטת הניצחון',
        'פסל הניצחון של בלגרד',
      ],
    },
    {
      title: q('Mission 3 – The Tank Mission', 'משימה 3 – משימת הטנקים', 'Misija 3 – Misija tenkova'),
      question: q(
        'You are standing in front of a military exhibition.\n\nLook carefully at the tanks on display.\n\nHow many tanks are there?\n\nEnter the number to continue.',
        'אתם עומדים מול תצוגה צבאית.\n\nהביטו בקפידה בטנקים המוצגים.\n\nכמה טנקים יש?\n\nהזינו את המספר.',
        'Odlično! Nastavljate dalje.\nNalazite se u jednoj od najstarijih tvrđava u Evropi.\nVaš sledeći zadatak:\n– istražite vojnu postavku\n– i izbrojte koliko tenkova se nalazi u prostoru\nPažljivo posmatrajte — detalji su ključ.\nIstorija vas zove.'
      ),
      videos: [V.v3],
      images: [],
      answerType: 'text',
      answers: [
        '14', 'fourteen', 'četrnaest', 'четрнаест',
        'ארבע עשרה', 'ארבע-עשרה',
      ],
    },
    {
      title: q('Mission 4 – The Graffiti Mission', 'משימה 4 – משימת הגרפיטי', 'Misija 4 – Misija grafita'),
      question: q(
        'Somewhere on the streets of Belgrade hides a piece of street art — bold, colourful, unmissable once you know where to look.\n\nFind the graffiti.\n\nWhat is its address?\n\nEnter the address and upload a photo of you standing in front of it.',
        'איפשהו ברחובות בלגרד מסתתרת יצירת רחוב — נועזת, צבעונית, בלתי נשכחת.\n\nמצאו את הגרפיטי.\n\nמה הכתובת שלו?\n\nהזינו את הכתובת המדויקת והעלו תמונה שלכם מולו.',
        'Beograd nije samo istorija — on je i umetnost.\nGrafiti ovde nisu samo crteži, već priče, emocije i protesti.\nVaš zadatak:\n– pronađite zadati grafit\n– i utvrdite njegovu tačnu lokaciju\nBudite pažljivi i koristite sve što imate — čak i pomoć lokalaca.'
      ),
      videos: [V.v4],
      images: [require('../../assets/images/belg_p4.jpg')],
      answerType: 'text+photo',
      clue: q('Get to the area of Hotel Bristol', 'הגיעו לאזור מלון בריסטול', 'Idite do oblasti Hotela Bristol'),
      answers: [
        'karađorđeva 49', 'karadordeva 49', 'karađorđeva49', 'karadordeva49',
        'karadordjeva 49', '49 karađorđeva',
        'קארדורדבה 49', 'קרדורדבה 49', 'קארדורדבה49', 'קרדורדבה49',
      ],
    },
    {
      title: q('Mission 5 – The Poet Mission', 'משימה 5 – משימת המשורר', 'Misija 5 – Misija pesnika'),
      question: q(
        "Welcome to Skadarlija — Belgrade's bohemian quarter, where poets, artists and dreamers have gathered for centuries.\n\nWatch the video, then channel your inner poet.\n\nRecord a short video of yourself performing — a poem, a song, a toast — anything that captures the spirit of this magical street.",
        'ברוכים הבאים לסקדרליה — הרחוב הבוהמי המפורסם של בלגרד.\n\nכשתגיעו לפסל של יאקשיץ׳, עליכם לגייס תושב מקומי — כן, תושב בלגרד אמיתי — להצטלם איתכם ליד הפסל ולצטט אחת מהלשוניות הקסומות שלנו בעברית:\n\n"גנן גידל דגן בגן דגן גדל בגן גנן..."\nאו\n"שרה שרה שיר שרה שמח שיר שמח שרה..."\n\nשימו לב: חובה לומר את המשפט ברציפות!\n\nרשמו סרטון והעלו אותו.',
        'Dobrodošli u Skadarliju — boemsku ulicu Beograda.\nOvde su živeli pesnici, umetnici i sanjari.\nU srcu ulice nalazi se spomenik Đuri Jakšiću — pesniku i slikaru.\nVaš zadatak:\n– pronađite spomenik\n– i zamolite lokalca da izgovori brzalicu:\n„Četiri čavčića na čunčiću čuče."\nMora bez greške.'
      ),
      videos: [V.v5],
      images: [],
      answerType: 'video_upload',
      answers: [],
    },
    {
      title: q('Mission 6 – The Princess Profiterole', 'משימה 6 – נסיכת הפחזניות', 'Misija 6 – Princeza profiterola'),
      question: q(
        'The Princess awaits you with her delicious profiteroles.\n\nChoose your favourite flavour from what she offers and write it below.',
        'הגיעו ל-Republic Square ומצאו את נסיכת הפחזניות.\n\nכשתמצאו אותה, רשמו באפליקציה את הטעם האהוב עליכם שהנסיכה מציעה.',
        'Sledeći cilj je Trg republike.\nVaš zadatak:\n– pronađite Princezu profiterola\n– i izaberite omiljeni ukus\nSlobodno se nagradite — trka postaje sve slađa.'
      ),
      videos: [V.v6],
      images: [],
      answerType: 'text',
      answers: [
        'vanilla', 'vanilla & cherry', 'vanilla and cherry',
        'coffee', 'caramel', 'raspberry',
        'white chocolate & strawberry', 'white chocolate and strawberry',
        'white chocolate & coconut milk', 'white chocolate and coconut milk',
        'white chocolate & hazelnut', 'white chocolate and hazelnut',
        'milk chocolate & almond', 'milk chocolate and almond',
        'two chocolates', 'mascarpone & blueberry', 'mascarpone and blueberry',
        'pistachio',
        'vanila', 'vanila & višnja', 'vanila i višnja',
        'kafa', 'karamela', 'malina',
        'bela čokolada & jagoda', 'bela čokolada i jagoda',
        'bela čokolada & kokosovo mleko', 'bela čokolada i kokosovo mleko',
        'bela čokolada & lešnik', 'bela čokolada i lešnik',
        'mlečna čokolada & badem', 'mlečna čokolada i badem',
        'dve čokolade', 'maskarpone & borovnica', 'maskarpone i borovnica',
        'pistać',
        'וניל', 'וניל ודובדבן', 'וניל & דובדבן',
        'קפה', 'קרמל', 'פטל',
        'שוקולד לבן ותות', 'שוקולד לבן & תות',
        'שוקולד לבן וחלב קוקוס', 'שוקולד לבן & חלב קוקוס',
        'שוקולד לבן ואגוז לוז', 'שוקולד לבן & אגוז לוז',
        'שוקולד חלב ושקד', 'שוקולד חלב & שקד',
        'שני סוגי שוקולד', 'שני שוקולדים',
        'מסקרפונה ואוכמניות', 'מסקרפונה & אוכמניות',
        'פיסטוק',
      ],
    },
    {
      title: q('Mission 7 – The Macarena Mission', 'משימה 7 – משימת המקרנה', 'Misija 7 – Misija Macarene'),
      question: q(
        "Time to turn the streets of Belgrade into your stage!\n\nYour mission: perform the Macarena dance with at least 4 local people.\n\nRecord a short video — be bold, be fun, be unforgettable.\n\n* Video must be between 15 and 30 seconds.",
        'בלב בלגרד, בין רחובות מלאי חיים, אתם עומדים להפוך לרגע למוקד תשומת הלב של כולם.\n\nעליכם:\n• לבצע את ריקוד המקרנה\n• אתם ועוד ארבעה אנשים מקומיים (או שאחד מכם מצלם ואז אתם ועוד חמישה)\n• במשך לפחות 15 שניות\n• והכל חייב להיות מצולם!\n\nרשמו סרטון והעלו אותו.\n\n* הסרטון חייב להיות עד 30 שניות.',
        'Sada podižemo nivo.\nVaš zadatak:\n– izvedite ples Macarena\n– sa najmanje 4 lokalne osobe\n– snimite video od najmanje 15 sekundi\nPretvorite ulicu u scenu.\n\n* Video mora biti kraći od 30 sekundi.'
      ),
      videos: [V.v7],
      images: [],
      answerType: 'video_upload',
      answers: [],
    },
    {
      title: q('Mission 8 – The Chocolate Mission', 'משימה 8 – משימת השוקולד', 'Misija 8 – Misija čokolade'),
      question: raceType === 'short'
        ? q(
            "You've reached San Marina, one of the city's best-known chocolate shops — and your finish line. Somewhere among the shelves, one chocolate is marked with the Big Race symbol. It's yours. Find it, write down its name, and take a photo with it. Shop closed? Stand at the window, spot the chocolate with our symbol, and take your photo there. That's it — you've finished.",
            'הגעתם ל-San Marina, אחת מחנויות השוקולד הידועות בעיר — וזו גם נקודת הסיום שלכם. בין כל המדפים מסתתר שוקולד אחד שמסומן בסמל המירוץ. הוא שלכם. מצאו אותו, תכתבו את שמו והצטלמו איתו. אם החנות סגורה — עמדו מול הויטרינה, אתרו את השוקולד עם הסמל, והצטלמו שם. זהו. סיימתם.',
            'Stigli ste u San Marina, jednu od najpoznatijih čokoladnica u gradu — i to je vaš cilj. Među policama krije se jedna čokolada označena simbolom Big Race. Ona je vaša. Pronađite je, zapišite njeno ime i fotografišite se sa njom. Radnja je zatvorena? Stanite ispred izloga, pronađite čokoladu sa našim simbolom i tu se fotografišite. To je to — završili ste trku.'
          )
        : q(
            'You have earned some chocolate.\n\nBut first — where are you headed next?\n\nWatch the video and figure out your next destination.\n\nWrite the name of the next location to continue.',
            'הגעתם ל-San Marina, אחת מחנויות השוקולד הידועות בעיר.\n\nבין כל המדפים מסתתר שוקולד אחד שינחה אתכם ליעד הבא.\n\nאם החנות סגורה? פשוט עמדו מול הויטרינה, מצאו את השוקולד הנכון וגלו לאן הדרך ממשיכה.\n\nכתבו את שם המיקום הבא.',
            'Vaša sledeća stanica je San Marina.\nVaš zadatak:\n– pronađite posebnu čokoladu\n– ona će vas voditi dalje u igri\nAko je radnja zatvorena — pronađite je u izlogu.'
          ),
      videos: [V.v8],
      images: [],
      answerType: raceType === 'short' ? 'text+photo' : 'text',
      answers: [
        'saint sava', 'saint sava temple', 'sava saint',
        'hram svetog save', 'sveti sava', 'crkva svetog save',
        'храм светог саве', 'свети сава',
        'סנט סאבה', 'סינט סאבה',
        'כנסיית סנט סאבה', 'כנסיית סינט סאבה',
        'מקדש סנט סאבה', 'מקדש סינט סאבה',
      ],
    },
    {
      title: q('Mission 9 – The Final Mission', 'משימה 9 – המשימה האחרונה', 'Misija 9 – Poslednja misija'),
      question: q(
        'You have made it to the final mission.\n\nInside this sacred place, words echo in many languages — ancient words, timeless words, known to millions across the world.\n\nLook at the gate. Find the words inscribed there. Write them down.\n\n* Enter only the first line of the inscription.\n\nThen upload a photo of you at this final location.',
        'הגעתם לנקודת הסיום של המירוץ — כנסיית סנט סאבה.\n\nבמקום הקדוש ביותר בעיר, שפה עתיקה מופיעה במקום שאיש אינו מצפה לראותה. לא על קיר, לא על ספר, לא על מזבח — אלא על השער: שער שבו כל השפות כתובות בריבועים, שער שנפתח אל מול שמיים לבנים.\n\nמצאו את המילים הכתובות שם, רשמו אותן.\n\n* יש להזין את השורה הראשונה בלבד של הכיתוב.\n\nלאחר מכן העלו תמונה שלכם במיקום הסופי הזה.',
        'Poslednja stanica.\nVaš zadatak:\n– pronađite skriveni natpis na kapiji\n– unesite ga u aplikaciju\n\n* Unesite samo prvi red natpisa.\n\nZatim otpremite fotografiju na ovoj poslednjoj lokaciji.'
      ),
      videos: [V.v9],
      images: [],
      answerType: 'text+photo',
      answers: [
        "אבונא די בשמיא יתקדש",
        "PATER NOSTER QUI",
        "ОЧЕ НАШ КОЈИ СИ",
        "ОТЧЕ НАШЪ  ИЖЕ ЕСИ НА",
      ],
    },
  ];
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { t, isRTL, language } = useTranslation();
  const baseV = getVideos(language);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showGameModal, setShowGameModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showWatchVideosModal, setShowWatchVideosModal] = useState(false);
  const [showRaceTypeModal, setShowRaceTypeModal] = useState(false);

  const [gameCode, setGameCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [raceType, setRaceType] = useState(null);
  const [codeTier, setCodeTier] = useState(null);

  const shortOverrides = raceType === 'short' ? getShortVideoOverrides(language) : {};
  const V = { ...baseV, ...shortOverrides };
  const allBelgradeQuestions = getBelgradeQuestions(V, language, raceType);

  const SHORT_EXCLUDED_INDICES = [3, 8];
  const belgradeQuestions = raceType === 'short'
    ? allBelgradeQuestions.filter((_, i) => !SHORT_EXCLUDED_INDICES.includes(i))
    : allBelgradeQuestions;

  const [hasValidCode, setHasValidCode] = useState(false);
  const [codeChecked, setCodeChecked] = useState(false);

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [furthestQuestion, setFurthestQuestion] = useState(0);
  const [textAnswer, setTextAnswer] = useState('');
  const [photoUri, setPhotoUri] = useState(null);
  const [videoUri, setVideoUri] = useState(null);
  const [wrongAnswer, setWrongAnswer] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [codeFocused, setCodeFocused] = useState(false);
  const [answerFocused, setAnswerFocused] = useState(false);
  const [clueVisible, setClueVisible] = useState(false);
  const [videoWatched, setVideoWatched] = useState({});

  // Telemetry bookkeeping (not UI state)
  const missionStartedAtRef = useRef({});   // mission index -> timestamp
  const wrongAttemptsRef = useRef({});      // mission index -> wrong answers
  const backgroundCountRef = useRef({});    // mission index -> times app left
  const backgroundedAtRef = useRef(null);

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

  // ── Monitoring context: attached to every logged event ────────────────────
  useEffect(() => {
    setContext({
      game_code: gameCode || null,
      race_type: raceType,
      mission: showGameModal ? currentQuestion + 1 : null,
    });
  }, [gameCode, raceType, currentQuestion, showGameModal]);

  // Index already-downloaded videos so players can use them straight away
  useEffect(() => {
    const lang = VIDEOS[language] ? language : 'en';
    warmVideoCache([
      ...Object.values(VIDEOS[lang]).map((v) => v.uri),
      ...Object.values(SHORT_VIDEOS[lang]).map((v) => v.uri),
    ]);
  }, [language]);

  // Once the team has a valid code, pre-download the welcome video and then
  // mission 1 while they're still on the home screen (usually hotel wifi), so
  // the race opens instantly. Both are the same for short and long races.
  useEffect(() => {
    if (!hasValidCode) return;
    const lang = VIDEOS[language] ? language : 'en';
    prefetchVideo(VIDEOS[lang].welcome.uri, 'welcome')
      .then(() => prefetchVideo(VIDEOS[lang].v1.uri, 'v1'));
  }, [hasValidCode, language]);

  // ── Remote answers — fetch overrides from Firebase on mount ────────────────
  const [remoteAnswers, setRemoteAnswers] = useState(null);

  useEffect(() => {
    get(ref(db, 'mission_answers'))
      .then((snap) => { if (snap.exists()) setRemoteAnswers(snap.val()); })
      .catch((e) => logWarning('remote_answers_fetch_failed', errorFields(e),
        'Could not load extra accepted answers from the database'));
  }, []);

  // ── Set audio mode so videos play sound even with iPhone silent switch ─────
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
  }, []);

  // ── Save race progress when app goes to background ─────────────────────────
  const saveCurrentProgress = useCallback(() => {
    if (showGameModal && startTime && finalTime === null) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      saveRaceProgress({
        gameCode,
        selectedCountry,
        currentQuestion,
        raceType,
        startTime,
        elapsedAtSave: elapsed,
        savedAt: Date.now(),
        userId: user?.uid,
      });
    }
  }, [showGameModal, startTime, finalTime, gameCode, selectedCountry, currentQuestion, raceType, user]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const inRace = showGameModal && startTime && finalTime === null;
      if (nextState.match(/inactive|background/)) {
        saveCurrentProgress();
        if (inRace && nextState === 'background' && !backgroundedAtRef.current) {
          backgroundedAtRef.current = Date.now();
          const count = (backgroundCountRef.current[currentQuestion] || 0) + 1;
          backgroundCountRef.current[currentQuestion] = count;
          logEvent('race_backgrounded', { count_this_mission: count }, {
            severity: count > 3 ? Severity.WARNING : Severity.INFO,
            message: `Left the app during mission ${currentQuestion + 1} (${count}x on this mission)`,
          });
        }
      } else if (nextState === 'active' && backgroundedAtRef.current) {
        const awayMs = Date.now() - backgroundedAtRef.current;
        backgroundedAtRef.current = null;
        if (inRace) logInfo('race_foregrounded', { away_ms: awayMs }, `Back in the app after ${Math.round(awayMs / 1000)}s`);
      }
    });
    return () => subscription.remove();
  }, [saveCurrentProgress, showGameModal, startTime, finalTime, currentQuestion]);

  // ── Restore race progress on mount ────────────────────────────────────────
  const [savedProgress, setSavedProgress] = useState(null);

  const checkSavedProgress = useCallback(async () => {
    const saved = await loadRaceProgress();
    if (!saved || saved.userId !== user?.uid) {
      if (saved) logInfo('progress_discarded', { reason: 'different_user' }, 'Saved progress belongs to another user');
      await clearRaceProgress();
      setSavedProgress(null);
      return;
    }
    const hoursSinceSave = (Date.now() - saved.savedAt) / (1000 * 60 * 60);
    if (hoursSinceSave > 30 * 24) {
      logInfo('progress_discarded', { reason: 'expired', hours_since_save: Math.round(hoursSinceSave) },
        'Saved progress older than 30 days');
      await clearRaceProgress();
      setSavedProgress(null);
      return;
    }
    setSavedProgress(saved);
  }, [user]);

  const resumeRace = useCallback(async () => {
    if (!savedProgress) return;
    logInfo('progress_restored', {
      restored_mission: savedProgress.currentQuestion + 1,
      elapsed_s: savedProgress.elapsedAtSave,
      hours_since_save: Math.round(((Date.now() - savedProgress.savedAt) / 3600000) * 10) / 10,
      restored_race_type: savedProgress.raceType || 'long',
    }, `Resumed race at mission ${savedProgress.currentQuestion + 1}`);
    missionStartedAtRef.current = { [savedProgress.currentQuestion]: Date.now() };
    setGameCode(savedProgress.gameCode);
    setSelectedCountry(savedProgress.selectedCountry);
    setCurrentQuestion(savedProgress.currentQuestion);
    setFurthestQuestion(savedProgress.currentQuestion);
    setRaceType(savedProgress.raceType || 'long');
    setHasValidCode(true);
    const resumedStart = Date.now() - savedProgress.elapsedAtSave * 1000;
    setStartTime(resumedStart);
    setElapsedTime(savedProgress.elapsedAtSave);
    setFinalTime(null);
    setShowGameModal(true);
    await clearRaceProgress();
    setSavedProgress(null);
  }, [savedProgress]);

  const dismissSavedProgress = useCallback(async () => {
    logInfo('progress_discarded', {
      reason: 'user_dismissed', saved_mission: savedProgress ? savedProgress.currentQuestion + 1 : null,
    }, 'User chose not to resume their saved race');
    await clearRaceProgress();
    setSavedProgress(null);
  }, [savedProgress]);

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
            if (codeSnap.exists()) {
              const codeVal = String(codeSnap.val());
              setGameCode(codeVal);
              setCodeTier(codeVal.length >= 6 ? 'long' : 'short');
            }
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
            logInfo('code_expired_cleared', { age_days: Math.floor(age / 86400000) },
              'Activation older than 30 days — cleared');
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
        logError('code_flag_check_failed', errorFields(e),
          'Could not check whether this user already activated a code — they will be asked for it again');
        setHasValidCode(false);
      } finally {
        setCodeChecked(true);
      }
    };
    checkCodeFlag().then(() => checkSavedProgress());
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
    const validateStarted = Date.now();
    const invalid = (reason, extra = {}) => logWarning('code_invalid', {
      reason, attempted_code: trimmed.slice(0, 20), code_length: trimmed.length, ...extra,
    }, `Code rejected: ${reason}`);
    try {
      // ── Find matching code in activation_codes/ ───────────────────────────
      const codesSnap = await get(ref(db, 'activation_codes'));
      if (!codesSnap.exists()) {
        logError('code_list_empty', {}, 'activation_codes is empty or unreadable');
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
        invalid('not_found');
        Alert.alert(t('invalidCode'), t('invalidCodeMsg'));
        return;
      }

      if (codeData.expired === true) {
        invalid('expired', { tier: codeData.tier });
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

      const activateAndProceed = async (role) => {
        logInfo('code_activated', {
          tier, role, activated_code: trimmed.slice(0, 20), lookup_ms: Date.now() - validateStarted,
        }, `Code activated (${tier}, ${role})`);
        await saveUserFlag();
        setGameCode(trimmed);
        setCodeTier(trimmed.length >= 6 ? 'long' : 'short');
        setHasValidCode(true);
        setShowCodeModal(false);
        setShowCountryModal(true);
      };

      // ─────────────────────────────────────────────────────────────────────
      // TIER: 1dev — email must match, single user only
      // ─────────────────────────────────────────────────────────────────────
      if (tier === '1dev') {
        if (currentEmail !== codeEmail?.toLowerCase().trim()) {
          invalid('email_mismatch', { tier });
          Alert.alert(t('invalidCode'), t('invalidCodeMsg'));
          return;
        }
        await markCodeUsed();
        await activateAndProceed('primary');
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
        await activateAndProceed('primary');
        return;
      }

      // Secondary user — already registered under this code (re-login)
      const alreadyJoined = joinedUsers.some((entry) => entry.uid === user.uid);
      if (alreadyJoined) {
        await activateAndProceed('secondary_rejoin');
        return;
      }

      // Check remaining slots
      if (joinedUsers.length >= maxExtras) {
        invalid('full', { tier, joined: joinedUsers.length, max_extras: maxExtras });
        Alert.alert(t('invalidCode'), t('codeFull'));
        return;
      }

      // Slot open — register secondary user under the code node
      await push(ref(db, `activation_codes/${codeKey}/joinedUsers`), {
        uid: user.uid,
        email: user.email,
        joinedAt: Date.now(),
      });
      await activateAndProceed('secondary_new');

    } catch (e) {
      console.error('validateCode error:', e);
      logCritical('code_validate_error', {
        ...errorFields(e), attempted_code: trimmed.slice(0, 20), lookup_ms: Date.now() - validateStarted,
      }, 'Code check failed (network/database) — customer could not get into the game');
      Alert.alert(t('error'), t('validateError'));
    } finally {
      setIsValidating(false);
    }
  };

  // ── City selected ──────────────────────────────────────────────────────────
  const selectCountry = (country) => {
    setSelectedCountry(country);
    setShowCountryModal(false);
    if (codeTier === 'long') {
      setShowRaceTypeModal(true);
    } else {
      setRaceType('short');
      setShowWatchVideosModal(true);
    }
  };

  const selectRaceType = (type) => {
    logInfo('race_type_selected', { selected: type }, `Chose the ${type} race`);
    setRaceType(type);
    setShowRaceTypeModal(false);
    setShowWatchVideosModal(true);
  };

  const handleWatchVideosConfirm = () => {
    setShowWatchVideosModal(false);
    setWelcomeEnded(false);
    setShowSkipWelcome(false);
    setShowWelcomeModal(true);
    ScreenOrientation.unlockAsync();
    skipWelcomeTimerRef.current = setTimeout(() => setShowSkipWelcome(true), 5000);
  };

  const handleWelcomeVideoEnd = () => {
    if (skipWelcomeTimerRef.current) clearTimeout(skipWelcomeTimerRef.current);
    setShowSkipWelcome(true);
    setWelcomeEnded(true);
  };

  const handleSkipWelcome = async () => {
    if (skipWelcomeTimerRef.current) clearTimeout(skipWelcomeTimerRef.current);
    const st = await welcomeVideoRef.current?.getStatusAsync().catch(() => null);
    logInfo('video_skipped', { video_id: 'welcome', position_ms: st?.positionMillis ?? null, duration_ms: st?.durationMillis ?? null },
      'Skipped the welcome video');
    if (welcomeVideoRef.current) await welcomeVideoRef.current.pauseAsync().catch(() => {});
    setWelcomeEnded(true);
    setShowSkipWelcome(true);
  };

  const handleFinishVideoEnd = () => {
    if (skipFinishTimerRef.current) clearTimeout(skipFinishTimerRef.current);
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    setFinishVideoEnded(true);
  };

  const handleSkipFinish = async () => {
    if (skipFinishTimerRef.current) clearTimeout(skipFinishTimerRef.current);
    const st = await finishVideoRef.current?.getStatusAsync().catch(() => null);
    logInfo('video_skipped', { video_id: 'final', position_ms: st?.positionMillis ?? null, duration_ms: st?.durationMillis ?? null },
      'Skipped the final video');
    if (finishVideoRef.current) await finishVideoRef.current.pauseAsync().catch(() => {});
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    setFinishVideoEnded(true);
  };

  // ── Video failed → back to home with a message ───────────────────────────────
  // Progress is saved first so the team can resume once they have a connection.
  const handleVideoFailed = (where) => {
    if (where === 'final') {
      // Race is already recorded — just show the results instead of the video.
      handleFinishVideoEnd();
      return;
    }
    saveCurrentProgress();
    resetAll();
    setTimeout(() => checkSavedProgress(), 100);
    Alert.alert(
      t('videoFailedTitle'),
      t('videoFailedMsg').replace('{email}', SUPPORT_EMAIL),
      [
        {
          text: t('contactSupport'),
          onPress: () => {
            logInfo('support_contact_tapped', { from: where }, 'Opened support email after a video failure');
            Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {});
          },
        },
        { text: t('ok'), style: 'cancel' },
      ],
    );
  };

  // ── Mission start tracking ─────────────────────────────────────────────────
  useEffect(() => {
    if (!showGameModal || currentQuestion !== furthestQuestion) return;
    if (missionStartedAtRef.current[currentQuestion]) return;
    missionStartedAtRef.current[currentQuestion] = Date.now();
    logInfo('mission_start', { mission_number: currentQuestion + 1, of: belgradeQuestions.length },
      `Started mission ${currentQuestion + 1}`);
  }, [showGameModal, currentQuestion, furthestQuestion]);

  // ── Start Race ─────────────────────────────────────────────────────────────
  const startRace = () => {
    logInfo('race_start', {
      selected_race_type: raceType, code_tier: codeTier, missions: belgradeQuestions.length, city: selectedCountry,
    }, `Race started (${raceType}, ${belgradeQuestions.length} missions)`);
    missionStartedAtRef.current = {};
    wrongAttemptsRef.current = {};
    backgroundCountRef.current = {};
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    setShowWelcomeModal(false);
    setShowGameModal(true);
    const now = Date.now();
    setStartTime(now);
    setFinalTime(null);
    setElapsedTime(0);
    setCurrentQuestion(0);
    setFurthestQuestion(0);
    resetAnswerState();
    saveRaceProgress({
      gameCode, selectedCountry, currentQuestion: 0, raceType,
      startTime: now, elapsedAtSave: 0, savedAt: now, userId: user?.uid,
    });
  };

  // ── Media pickers ──────────────────────────────────────────────────────────
  const takePhotoFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      logError('permission_denied', { permission: 'camera', purpose: 'photo', status }, 'Camera permission denied for a photo mission');
      Alert.alert(t('permissionNeeded'), t('cameraPermission'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images', quality: 0.5, base64: true,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const pickPhotoFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      logError('permission_denied', { permission: 'media_library', status }, 'Photo library permission denied');
      Alert.alert(t('permissionNeeded'), t('permissionMsg'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', quality: 0.5, base64: true,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const pickPhoto = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [t('cancel'), t('fromCamera'), t('fromGallery')], cancelButtonIndex: 0 },
        (idx) => { if (idx === 1) takePhotoFromCamera(); else if (idx === 2) pickPhotoFromGallery(); }
      );
    } else {
      Alert.alert(t('choosePhotoSource'), '', [
        { text: t('fromCamera'), onPress: takePhotoFromCamera },
        { text: t('fromGallery'), onPress: pickPhotoFromGallery },
        { text: t('cancel'), style: 'cancel' },
      ]);
    }
  };

  const recordVideoFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      logError('permission_denied', { permission: 'camera', purpose: 'video', status }, 'Camera permission denied for a video mission');
      Alert.alert(t('permissionNeeded'), t('cameraVideoPermission'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'videos', videoMaxDuration: 30,
    });
    if (!result.canceled) setVideoUri(result.assets[0].uri);
  };

  const pickVideoFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      logError('permission_denied', { permission: 'media_library', status }, 'Photo library permission denied');
      Alert.alert(t('permissionNeeded'), t('permissionMsg'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'videos',
    });
    if (!result.canceled) setVideoUri(result.assets[0].uri);
  };

  const pickVideo = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [t('cancel'), t('recordVideo'), t('fromGallery')], cancelButtonIndex: 0 },
        (idx) => { if (idx === 1) recordVideoFromCamera(); else if (idx === 2) pickVideoFromGallery(); }
      );
    } else {
      Alert.alert(t('choosePhotoSource'), '', [
        { text: t('recordVideo'), onPress: recordVideoFromCamera },
        { text: t('fromGallery'), onPress: pickVideoFromGallery },
        { text: t('cancel'), style: 'cancel' },
      ]);
    }
  };

  // Uploads one submission and logs the outcome. Failures don't block the team
  // (same as before) but are now logged as CRITICAL instead of vanishing.
  const uploadSubmission = async (uri, dbPath, kind) => {
    const started = Date.now();
    const info = await FileSystem.getInfoAsync(uri).catch(() => null);
    const fields = { kind, bytes: info?.size ?? null, mission_number: currentQuestion + 1 };
    try {
      await saveFileToDatabase(uri, dbPath);
      logInfo('upload_succeeded', { ...fields, upload_ms: Date.now() - started },
        `Uploaded mission ${currentQuestion + 1} ${kind}`);
    } catch (e) {
      console.warn(`${kind} upload failed silently:`, e);
      logCritical('upload_failed', { ...fields, ...errorFields(e), upload_ms: Date.now() - started },
        `Mission ${currentQuestion + 1} ${kind} upload failed — submission lost`);
    }
  };

  const saveFileToDatabase = async (uri, dbPath) => {
    const isVideo = uri.includes('video') || uri.endsWith('.mp4') || uri.endsWith('.mov');
    if (isVideo) {
      // Upload via REST API — Firebase Storage SDK uses Blob internally which
      // is not supported in React Native production builds
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const storagePath = encodeURIComponent(`${dbPath}.mp4`);
      const bucket = 'triptailor-71050.firebasestorage.app';
      const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${storagePath}`;

      const { getAuth: getAuthInstance } = await import('firebase/auth');
      const token = await getAuthInstance().currentUser?.getIdToken();

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'video/mp4',
          'Authorization': `Firebase ${token}`,
          'Content-Transfer-Encoding': 'base64',
        },
        body: base64,
      });

      if (!response.ok) {
        const err = new Error(`Upload failed: ${response.status}`);
        err.code = `http_${response.status}`;
        throw err;
      }
      const json = await response.json();
      const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${storagePath}?alt=media&token=${json.downloadTokens}`;
      await set(ref(db, dbPath), downloadUrl);

    } else {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      await set(ref(db, dbPath), base64);
    }
  };

  const resetAnswerState = () => {
    setTextAnswer(''); setPhotoUri(null); setVideoUri(null); setWrongAnswer(false); setClueVisible(false);
    setVideoWatched({});
  };

  // ── Submit answer ──────────────────────────────────────────────────────────
  const submitAnswer = async () => {
    const q = belgradeQuestions[currentQuestion];
    const vKey = `${currentQuestion}-0`;
    if (q.videos && q.videos.length > 0 && !videoWatched[vKey]) {
      logWarning('video_submit_blocked', { video_id: q.videos[0]?.id }, 'Submit pressed before the mission video was watched');
      Alert.alert(t('watchVideoFirst'), t('watchVideoFirstMsg'));
      return;
    }
    if (q.answerType === 'text' || q.answerType === 'text+photo') {
      if (q.answers.length > 0) {
        const remoteList = remoteAnswers?.[`q${currentQuestion + 1}`];
        const allAnswers = remoteList ? [...q.answers, ...remoteList] : q.answers;
        const normalize = (s) => s.toLowerCase().trim().replace(/\s+/g, ' ')
          .replace(/[čć]/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z').replace(/đ/g, 'd');
        const normalizedInput = normalize(textAnswer);
        const textOk = allAnswers.some(a => normalize(a) === normalizedInput);
        if (!textOk) {
          const attempts = (wrongAttemptsRef.current[currentQuestion] || 0) + 1;
          wrongAttemptsRef.current[currentQuestion] = attempts;
          logInfo('answer_wrong', {
            mission_number: currentQuestion + 1, attempt: attempts, answer: textAnswer.trim().slice(0, 50),
          }, `Wrong answer on mission ${currentQuestion + 1}: "${textAnswer.trim().slice(0, 50)}"`);
          if (attempts === 3) {
            logWarning('answer_repeated_wrong', { mission_number: currentQuestion + 1, attempt: attempts },
              `3 wrong answers on mission ${currentQuestion + 1}`);
          }
          setWrongAnswer(true);
          return;
        }
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
      if (photoUri) await uploadSubmission(photoUri, `${basePath}/picture`, 'photo');
      if (videoUri) await uploadSubmission(videoUri, `${basePath}/video`, 'video');
      const missionStarted = missionStartedAtRef.current[currentQuestion];
      logInfo('mission_complete', {
        mission_number: currentQuestion + 1,
        duration_s: missionStarted ? Math.round((Date.now() - missionStarted) / 1000) : null,
        wrong_attempts: wrongAttemptsRef.current[currentQuestion] || 0,
        clue_used: clueVisible,
        times_backgrounded: backgroundCountRef.current[currentQuestion] || 0,
      }, `Completed mission ${currentQuestion + 1}`);
      if (currentQuestion === belgradeQuestions.length - 1) {
        const stopped = elapsedTime;
        logInfo('race_complete', { total_s: stopped, missions: belgradeQuestions.length },
          `Race finished in ${formatTime(stopped)}`);
        setFinalTime(stopped);
        await saveResults(stopped);
        await clearRaceProgress();
        setShowGameModal(false);
        setFinishVideoEnded(false);
        setShowSkipFinish(false);
        skipFinishTimerRef.current = setTimeout(() => setShowSkipFinish(true), 5000);
        ScreenOrientation.unlockAsync();
        setShowEndModal(true);
      } else {
        const nextQ = currentQuestion + 1;
        setCurrentQuestion(nextQ);
        setFurthestQuestion(nextQ);
        resetAnswerState();
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        saveRaceProgress({
          gameCode, selectedCountry, currentQuestion: nextQ, raceType,
          startTime, elapsedAtSave: elapsed, savedAt: Date.now(), userId: user?.uid,
        });
      }
    } catch (e) {
      console.error('Upload error:', e);
      logError('submit_failed', { mission_number: currentQuestion + 1, ...errorFields(e) },
        `Submitting mission ${currentQuestion + 1} failed`);
      Alert.alert(t('uploadFailed'), t('uploadFailedMsg'));
    } finally {
      setIsUploading(false);
    }
  };

  // ── Save results ───────────────────────────────────────────────────────────
  const saveResults = async (time) => {
    if (!user) {
      logCritical('results_save_failed', { reason: 'no_user', total_s: time }, 'Race finished but no signed-in user — result not saved');
      return;
    }
    try {
      await push(ref(db, `users/${user.uid}/results/races`), {
        gameCode, country: selectedCountry, time,
        completedAt: Date.now(),
        playedByUserId: user.uid,
        playedByEmail: user.email,
      });
    } catch (e) {
      console.error('Error saving results:', e);
      logCritical('results_save_failed', { ...errorFields(e), total_s: time },
        'Race finished but the result could not be saved — missing from leaderboard');
      Alert.alert(t('error'), t('saveError'));
    }
  };

  // ── Exit game ──────────────────────────────────────────────────────────────
  const exitGame = () => {
    Alert.alert(t('exitTitle'), t('exitMessage'), [
      { text: t('stay'), style: 'cancel' },
      { text: t('exitConfirm'), style: 'destructive', onPress: async () => {
        logInfo('race_exit', { mission_number: currentQuestion + 1, elapsed_s: elapsedTime }, `Exited the race at mission ${currentQuestion + 1}`);
        saveCurrentProgress(); resetAll(); setTimeout(() => checkSavedProgress(), 100); } },
    ]);
  };

  // ── Full reset ─────────────────────────────────────────────────────────────
  const resetAll = () => {
    if (skipWelcomeTimerRef.current) clearTimeout(skipWelcomeTimerRef.current);
    if (skipFinishTimerRef.current) clearTimeout(skipFinishTimerRef.current);
    setShowEndModal(false); setShowCodeModal(false); setShowCountryModal(false);
    setShowWelcomeModal(false); setShowGameModal(false); setShowWatchVideosModal(false);
    setShowRaceTypeModal(false); setRaceType(null);
    setInputCode(''); setSelectedCountry('');
    setCurrentQuestion(0); setFurthestQuestion(0); resetAnswerState();
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
      {q.clue && (
        <View style={styles.clueBlock}>
          <TouchableOpacity
            style={styles.clueButton}
            onPress={() => {
              if (!clueVisible) logInfo('clue_opened', { mission_number: currentQuestion + 1 }, `Opened the clue on mission ${currentQuestion + 1}`);
              setClueVisible(v => !v);
            }}
          >
            <Text style={styles.clueButtonText}>
              {clueVisible ? t('hideClue') : t('showClue')}
            </Text>
          </TouchableOpacity>
          {clueVisible && (
            <View style={styles.clueCard}>
              <Text style={styles.clueLabel}>{t('clueLabel')}</Text>
              <Text style={[styles.clueText, textAlign]}>{q.clue}</Text>
            </View>
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

      {savedProgress && (
        <View style={styles.resumeBlock}>
          <TouchableOpacity style={styles.resumeButton} onPress={resumeRace}>
            <Text style={styles.resumeButtonText}>{t('resumeYes')}</Text>
            <Text style={styles.resumeInfo}>
              {t('missionLabel')} {savedProgress.currentQuestion + 1} / {savedProgress.raceType === 'short' ? allBelgradeQuestions.length - SHORT_EXCLUDED_INDICES.length : allBelgradeQuestions.length}  ·  {formatTime(savedProgress.elapsedAtSave)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dismissButton} onPress={dismissSavedProgress}>
            <Text style={styles.dismissButtonText}>{t('resumeNo')}</Text>
          </TouchableOpacity>
        </View>
      )}

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

      {/* ── Race Type Selection Modal ── */}
      <Modal visible={showRaceTypeModal} animationType="fade">
        <View style={styles.raceTypeScreen}>
          <Text style={styles.raceTypeScreenTitle}>{t('selectRaceType')}</Text>
          <Text style={[styles.raceTypeScreenSub, textAlign]}>{t('selectRaceTypeSub')}</Text>

          <TouchableOpacity style={[styles.raceTypeButton, styles.raceTypeShort]} onPress={() => selectRaceType('short')}>
            <Text style={styles.raceTypeEmoji}>⚡</Text>
            <Text style={styles.raceTypeLabel}>{t('shortRace')}</Text>
            <View style={styles.raceTypeDivider} />
            <Text style={[styles.raceTypeDesc, textAlign]}>{t('shortRaceDesc')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.raceTypeButton, styles.raceTypeLong]} onPress={() => selectRaceType('long')}>
            <Text style={styles.raceTypeEmoji}>🏁</Text>
            <Text style={styles.raceTypeLabel}>{t('longRace')}</Text>
            <View style={styles.raceTypeDivider} />
            <Text style={[styles.raceTypeDesc, textAlign]}>{t('longRaceDesc')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.raceTypeBack} onPress={() => { setShowRaceTypeModal(false); setShowCountryModal(true); }}>
            <Text style={styles.raceTypeBackText}>{t('cancel')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Watch Videos Interstitial ── */}
      <Modal visible={showWatchVideosModal} animationType="fade">
        <View style={styles.watchVideosScreen}>
          <Text style={styles.watchVideosIcon}>🎬</Text>
          <Text style={[styles.watchVideosTitle, textAlign]}>{t('watchVideosTitle')}</Text>
          <Text style={[styles.watchVideosMessage, textAlign]}>{t('watchVideosMessage')}</Text>
          <TouchableOpacity style={styles.watchVideosButton} onPress={handleWatchVideosConfirm}>
            <Text style={styles.watchVideosButtonText}>{t('watchVideosButton')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Welcome Video Modal ── */}
      <Modal visible={showWelcomeModal} animationType="fade">
        <View style={styles.videoFullScreen}>
          <MonitoredVideo
            ref={welcomeVideoRef}
            videoId="welcome"
            remoteUri={V.welcome.uri}
            onFailed={() => handleVideoFailed('welcome')}
            style={styles.fullScreenVideo}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
            useNativeControls
            onFullscreenUpdate={({ fullscreenUpdate }) => {
              if (fullscreenUpdate === Video.FULLSCREEN_UPDATE_PLAYER_WILL_PRESENT) {
                ScreenOrientation.unlockAsync();
              } else if (fullscreenUpdate === Video.FULLSCREEN_UPDATE_PLAYER_WILL_DISMISS) {
                ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
              }
            }}
            onPlaybackStatusUpdate={(status) => {
              // Pre-download mission 1 while the welcome video plays
              if (status.isLoaded) prefetchVideo(belgradeQuestions[0]?.videos[0]?.uri, belgradeQuestions[0]?.videos[0]?.id);
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
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={styles.gameContainer}>
            <View style={[styles.gameHeader, rowStyle]}>
              <View style={styles.timerContainer}>
                <Text style={styles.timerLabel}>{t('timerLabel')}</Text>
                <Text style={styles.timerText}>{formatTime(elapsedTime)}</Text>
              </View>
              <View style={[styles.headerButtons, rowStyle]}>
                {currentQuestion > 0 && (
                  <TouchableOpacity style={styles.backButton} onPress={() => setCurrentQuestion(currentQuestion - 1)}>
                    <Text style={styles.backButtonText}>{isRTL ? '→' : '←'} {t('backButton')}</Text>
                  </TouchableOpacity>
                )}
                {currentQuestion < furthestQuestion && (
                  <TouchableOpacity style={styles.nextButton} onPress={() => setCurrentQuestion(currentQuestion + 1)}>
                    <Text style={styles.nextButtonText}>{t('nextButton')} {isRTL ? '←' : '→'}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.exitButton} onPress={exitGame}>
                  <Text style={styles.exitButtonText}>{t('exit')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              style={styles.gameScroll}
              contentContainerStyle={styles.gameScrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              <Text style={[styles.questionNumber, textAlign]}>
                {t('missionLabel')} {currentQuestion + 1} / {belgradeQuestions.length}
              </Text>
              <Text style={[styles.missionTitle, textAlign]}>
                {belgradeQuestions[currentQuestion].title.replace(/^(Mission |משימה |Misija )\d+/, `$1${currentQuestion + 1}`)}
              </Text>

              {belgradeQuestions[currentQuestion].videos.map((src, i) => {
                const vKey = `${currentQuestion}-${i}`;
                const isWatched = videoWatched[vKey];
                // Next video to pre-download once this one is watched
                const nextSrc = belgradeQuestions[currentQuestion + 1]?.videos[0] ?? V.final;
                return (
                  <View key={vKey} style={styles.videoWrapper}>
                    <MonitoredVideo
                      videoId={src.id}
                      remoteUri={src.uri}
                      style={styles.mediaVideo}
                      useNativeControls resizeMode={ResizeMode.CONTAIN} shouldPlay={false}
                      onFullscreenUpdate={({ fullscreenUpdate }) => {
                        if (fullscreenUpdate === Video.FULLSCREEN_UPDATE_PLAYER_WILL_PRESENT) {
                          ScreenOrientation.unlockAsync();
                        } else if (fullscreenUpdate === Video.FULLSCREEN_UPDATE_PLAYER_WILL_DISMISS) {
                          ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
                        }
                      }}
                      onWatched={() => {
                        setVideoWatched(prev => ({ ...prev, [vKey]: true }));
                        prefetchVideo(nextSrc?.uri, nextSrc?.id);
                      }}
                      onFailed={() => handleVideoFailed(`mission_${currentQuestion + 1}`)}
                    />
                    {isWatched && (
                      <View style={styles.watchedBadge}>
                        <Text style={styles.watchedBadgeText}>✓ {t('videoWatched')}</Text>
                      </View>
                    )}
                  </View>
                );
              })}

              {belgradeQuestions[currentQuestion].images &&
                belgradeQuestions[currentQuestion].images.map((src, i) => (
                  <Image key={i} source={src} style={styles.mediaImage} resizeMode="contain" />
                ))}

              <Text style={[styles.questionText, textAlign]}>
                {belgradeQuestions[currentQuestion].question}
              </Text>

              {currentQuestion === furthestQuestion ? (
                <>
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
                </>
              ) : (
                <TouchableOpacity style={styles.primaryButton} onPress={() => setCurrentQuestion(furthestQuestion)}>
                  <Text style={styles.primaryButtonText}>{t('returnToCurrent')}</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── End / Finish Video Modal ── */}
      <Modal visible={showEndModal} animationType="fade">
        <View style={styles.videoFullScreen}>
          {!finishVideoEnded ? (
            <>
              <MonitoredVideo
                ref={finishVideoRef}
                videoId={V.final.id}
                remoteUri={V.final.uri}
                onFailed={() => handleVideoFailed('final')}
                style={styles.fullScreenVideo}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                useNativeControls
                onFullscreenUpdate={({ fullscreenUpdate }) => {
                  if (fullscreenUpdate === Video.FULLSCREEN_UPDATE_PLAYER_WILL_PRESENT) {
                    ScreenOrientation.unlockAsync();
                  } else if (fullscreenUpdate === Video.FULLSCREEN_UPDATE_PLAYER_WILL_DISMISS) {
                    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
                  }
                }}
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
              <Text style={styles.endTrophy}>🏆</Text>
              <Text style={[styles.endCongrats, textAlign]}>{t('congratulations')}</Text>
              <Text style={[styles.endTitle, textAlign]}>{t('raceComplete')}</Text>
              <Text style={[styles.endCity, textAlign]}>{t('belgradCircuit')}</Text>
              <View style={styles.endTimeCard}>
                <Text style={styles.endTimeLabel}>{t('finalTime')}</Text>
                <Text style={styles.endTimeValue}>{formatTime(finalTime ?? elapsedTime)}</Text>
              </View>
              <TouchableOpacity style={styles.primaryButton} onPress={resetAll}>
                <Text style={styles.primaryButtonText}>{t('backToHome')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.feedbackButton}
                onPress={() => Linking.openURL(FEEDBACK_URLS[language] || FEEDBACK_URLS.en)}
              >
                <Text style={styles.feedbackButtonText}>{t('feedbackButton')}</Text>
              </TouchableOpacity>
              <Text style={styles.feedbackSubtext}>{t('feedbackSubtext')}</Text>
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
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  backButton: { backgroundColor: C.surfaceHigh, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 4, borderWidth: 1, borderColor: C.outline },
  backButtonText: { color: C.onVariant, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  nextButton: { backgroundColor: C.surfaceHigh, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 4, borderWidth: 1, borderColor: C.primary },
  nextButtonText: { color: C.primary, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
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
  clueBlock: { marginBottom: 16 },
  clueButton: { backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.primary, borderRadius: 6, paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center' },
  clueButtonText: { color: C.primary, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  clueCard: { marginTop: 10, backgroundColor: C.surfaceBright, borderRadius: 6, borderLeftWidth: 3, borderLeftColor: C.primary, padding: 14 },
  clueLabel: { fontSize: 9, fontWeight: '700', color: C.primary, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 },
  clueText: { fontSize: 14, color: C.onSurface, lineHeight: 22 },
  uploadingContainer: { alignItems: 'center', marginVertical: 24 },
  uploadingText: { color: C.onVariant, fontSize: 11, marginTop: 12, letterSpacing: 3, textTransform: 'uppercase' },
  endResultsContainer: { flex: 1, backgroundColor: C.base, justifyContent: 'center', alignItems: 'center', padding: 32, width: '100%' },
  endTrophy: { fontSize: 72, marginBottom: 16 },
  endCongrats: { fontSize: 18, fontWeight: '700', color: C.secondary, textAlign: 'center', marginBottom: 12, lineHeight: 26 },
  endTitle: { fontSize: 32, fontWeight: '900', color: C.onSurface, letterSpacing: 3, marginBottom: 6, textTransform: 'uppercase' },
  endCity: { fontSize: 13, color: C.onVariant, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 36 },
  endTimeCard: { backgroundColor: C.surfaceLow, borderRadius: 8, borderWidth: 1, borderColor: C.secondary, paddingVertical: 20, paddingHorizontal: 40, alignItems: 'center', marginBottom: 36, width: '100%', shadowColor: C.secondary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 24 },
  endTimeLabel: { fontSize: 11, fontWeight: '700', color: C.secondary, letterSpacing: 3, marginBottom: 8, textTransform: 'uppercase' },
  endTimeValue: { fontSize: 44, fontWeight: '900', color: C.secondary, letterSpacing: 2 },
  logo: { width: 200, height: 200, marginBottom: 25 },
  resumeBlock: { width: '100%', marginBottom: 16 },
  resumeButton: { width: '100%', paddingVertical: 18, borderRadius: 4, backgroundColor: C.secondary, alignItems: 'center', justifyContent: 'center', marginBottom: 8, shadowColor: C.secondary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 8 },
  resumeButtonText: { color: C.base, fontSize: 14, fontWeight: '800', letterSpacing: 3, textTransform: 'uppercase' },
  resumeInfo: { color: 'rgba(6,14,32,0.6)', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 4 },
  dismissButton: { alignSelf: 'center', paddingVertical: 8 },
  dismissButtonText: { fontSize: 12, fontWeight: '700', color: C.onVariant, letterSpacing: 2, textTransform: 'uppercase', textDecorationLine: 'underline' },
  raceTypeScreen: { flex: 1, backgroundColor: C.base, justifyContent: 'center', alignItems: 'center', padding: 28 },
  raceTypeScreenTitle: { fontSize: 28, fontWeight: '900', color: C.primary, letterSpacing: 2, marginBottom: 10, textTransform: 'uppercase' },
  raceTypeScreenSub: { fontSize: 14, color: C.onVariant, lineHeight: 22, textAlign: 'center', marginBottom: 36, paddingHorizontal: 12 },
  raceTypeButton: { width: '100%', paddingVertical: 28, paddingHorizontal: 24, borderRadius: 12, marginBottom: 16, borderWidth: 1.5, alignItems: 'center' },
  raceTypeShort: { backgroundColor: C.surfaceLow, borderColor: C.primary },
  raceTypeLong: { backgroundColor: C.surfaceLow, borderColor: C.secondary },
  raceTypeEmoji: { fontSize: 36, marginBottom: 12 },
  raceTypeLabel: { fontSize: 20, fontWeight: '800', color: C.onSurface, letterSpacing: 3, textTransform: 'uppercase' },
  raceTypeDivider: { width: 40, height: 2, backgroundColor: C.outline, borderRadius: 1, marginVertical: 12 },
  raceTypeDesc: { fontSize: 14, color: C.onVariant, letterSpacing: 0.5, lineHeight: 20, textAlign: 'center' },
  raceTypeBack: { marginTop: 12, paddingVertical: 10 },
  raceTypeBackText: { fontSize: 13, fontWeight: '700', color: C.onVariant, letterSpacing: 2, textTransform: 'uppercase', textDecorationLine: 'underline' },
  watchVideosScreen: { flex: 1, backgroundColor: C.base, justifyContent: 'center', alignItems: 'center', padding: 36 },
  watchVideosIcon: { fontSize: 64, marginBottom: 28 },
  watchVideosTitle: { fontSize: 32, fontWeight: '900', color: C.primary, letterSpacing: 3, marginBottom: 20, textTransform: 'uppercase' },
  watchVideosMessage: { fontSize: 17, color: C.onSurface, lineHeight: 28, textAlign: 'center', marginBottom: 48 },
  watchVideosButton: { width: '100%', paddingVertical: 20, borderRadius: 4, backgroundColor: C.primary, alignItems: 'center', shadowColor: C.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 8 },
  watchVideosButtonText: { color: C.base, fontSize: 14, fontWeight: '800', letterSpacing: 3, textTransform: 'uppercase' },
  videoWrapper: { marginBottom: 16, position: 'relative' },
  watchedBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(105,246,184,0.9)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  watchedBadgeText: { color: C.base, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  feedbackButton: { width: '100%', paddingVertical: 14, borderRadius: 4, borderWidth: 1.5, borderColor: C.onVariant, alignItems: 'center', marginTop: 4 },
  feedbackButtonText: { color: C.onVariant, fontSize: 13, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  feedbackSubtext: { color: C.onVariant, fontSize: 13, marginTop: 10, textAlign: 'center', letterSpacing: 0.3 },
});