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
import { BW, C, F, R } from '../../constants/theme';
import { useTranslation } from '../../i18n';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const FEEDBACK_URLS = {
  en: 'https://docs.google.com/forms/d/e/1FAIpQLSeZQ2-l-mTr4UGcF2bRe7bcg0X3sc7B6u3DLSVIgnJRll8SgA/viewform',
  he: 'https://docs.google.com/forms/d/e/1FAIpQLSekUBgEn3zrgUTHYuPwLN3VnCwg4Xs2QItHHQZz6lASMyUQuw/viewform',
  sr: 'https://docs.google.com/forms/d/e/1FAIpQLSebbrk1w2vC_fWJcPAhlnrGPWexpxQSnyXRGUPJK3bw2-pTAw/viewform',
};

// ─── Firebase Storage video URLs ─────────────────────────────────────────────
const BUCKET = 'https://firebasestorage.googleapis.com/v0/b/triptailor-71050.firebasestorage.app/o';
const videoUrl = (filename) => `${BUCKET}/${encodeURIComponent(filename)}?alt=media`;

const VIDEOS = {
  // ── English (original) ──────────────────────────────────────────────────
  en: {
    welcome: { uri: videoUrl('belg_welcome_eng.mov') },
    final: { uri: videoUrl('belg_final_eng.mov') },
    v1: { uri: videoUrl('belg_v1.mov') },
    v2: { uri: videoUrl('belg_v2.mov') },
    v3: { uri: videoUrl('belg_v3.mov') },
    v4: { uri: videoUrl('belg_v4.mov') },
    v5: { uri: videoUrl('belg_v5.mov') },
    v6: { uri: videoUrl('belg_v6.mov') },
    v7: { uri: videoUrl('belg_v7.mov') },
    v8: { uri: videoUrl('belg_v8.mov') },
    v9: { uri: videoUrl('belg_v9.mov') },
  },

  // ── Hebrew ───────────────────────────────────────────────────────────────
  he: {
    welcome: { uri: videoUrl('WeELCOME HEBREW sub v2.0.mp4') },
    final: { uri: videoUrl('FINAL HEBREW sub.mp4') },
    v1: { uri: videoUrl('Misija 1 HEBREW sub v2.0.mp4') },
    v2: { uri: videoUrl('Misija 2 HEBREW sub.mp4') },
    v3: { uri: videoUrl('Misija 3 HEBREW sub.mp4') },
    v4: { uri: videoUrl('Misija 4 HEBREW Sub.mp4') },
    v5: { uri: videoUrl('Misija 5 HEBREW sub.mp4') },
    v6: { uri: videoUrl('Misija 6 HEBREW sub.mp4') },
    v7: { uri: videoUrl('Misija 7 HEBREW sub.mp4') },
    v8: { uri: videoUrl('Misija 8 HEBREW sub.mp4') },
    v9: { uri: videoUrl('Misija 9 HEBREW sub.mp4') },
  },

  // ── Serbian ──────────────────────────────────────────────────────────────
  sr: {
    welcome: { uri: videoUrl('WELCOME SERBIAN titl.mp4') },
    final: { uri: videoUrl('FINAL SERBIAN titl.mp4') },
    v1: { uri: videoUrl('Misija 1 SERBIAN titl.mp4') },
    v2: { uri: videoUrl('Misija 2 SERBIAN titl.mp4') },
    v3: { uri: videoUrl('Misija 3 SERBIAN titl.mp4') },
    v4: { uri: videoUrl('Misija 4 SERBIAN titl.mp4') },
    v5: { uri: videoUrl('Misija 5 SERBIAN titl 2.mp4') },
    v6: { uri: videoUrl('Misija 6 SERBIAN titl.mp4') },
    v7: { uri: videoUrl('Misija 7 SERBIAN titl.mp4') },
    v8: { uri: videoUrl('Misija 8 SERBIAN titl.mp4') },
    v9: { uri: videoUrl('Misija 9 SERBIAN titl.mp4') },
  },
};

// ─── Helper — pick the right video set for the current language ───────────
// Falls back to English if a language has no entry
const getVideos = (language) => VIDEOS[language] ?? VIDEOS.en;

// Short race video overrides — replace these URIs once Luka delivers the files
const SHORT_VIDEOS = {
  en: {
    v5: { uri: videoUrl('belg_v5_short_eng.mov') },
    v8: { uri: videoUrl('belg_v8_short_eng.mov') },
    final: { uri: videoUrl('belg_final_short_eng.mov') },
  },
  he: {
    v5: { uri: videoUrl('Misija 5 SHORT HEBREW sub.mp4') },
    v8: { uri: videoUrl('Misija 8 SHORT HEBREW sub.mp4') },
    final: { uri: videoUrl('FINAL SHORT HEBREW sub.mp4') },
  },
  sr: {
    v5: { uri: videoUrl('Misija 5 SHORT SERBIAN titl.mov') },
    v8: { uri: videoUrl('Misija 8 SHORT SERBIAN titl.mov') },
    final: { uri: videoUrl('FINAL SHORT SERBIAN titl.mov') },
  },
};

const getShortVideoOverrides = (language) => SHORT_VIDEOS[language] ?? SHORT_VIDEOS.en;

const RACE_PROGRESS_KEY = 'race_progress';

const saveRaceProgress = async (state) => {
  try {
    await AsyncStorage.setItem(RACE_PROGRESS_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save race progress:', e);
  }
};

const loadRaceProgress = async () => {
  try {
    const data = await AsyncStorage.getItem(RACE_PROGRESS_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.warn('Failed to load race progress:', e);
    return null;
  }
};

const clearRaceProgress = async () => {
  try {
    await AsyncStorage.removeItem(RACE_PROGRESS_KEY);
  } catch (e) {
    console.warn('Failed to clear race progress:', e);
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
  const [videoLoadErrors, setVideoLoadErrors] = useState({});
  const [showTextFallback, setShowTextFallback] = useState({});
  const videoLastProgress = useRef({});
  const videoStallTimers = useRef({});

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

  // ── Remote answers — fetch overrides from Firebase on mount ────────────────
  const [remoteAnswers, setRemoteAnswers] = useState(null);

  useEffect(() => {
    get(ref(db, 'mission_answers'))
      .then((snap) => { if (snap.exists()) setRemoteAnswers(snap.val()); })
      .catch(() => {});
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
  }, [showGameModal, startTime, finalTime, gameCode, selectedCountry, currentQuestion, user]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState.match(/inactive|background/)) {
        saveCurrentProgress();
      }
    });
    return () => subscription.remove();
  }, [saveCurrentProgress]);

  // ── Restore race progress on mount ────────────────────────────────────────
  const [savedProgress, setSavedProgress] = useState(null);

  const checkSavedProgress = useCallback(async () => {
    const saved = await loadRaceProgress();
    if (!saved || saved.userId !== user?.uid) {
      await clearRaceProgress();
      setSavedProgress(null);
      return;
    }
    const hoursSinceSave = (Date.now() - saved.savedAt) / (1000 * 60 * 60);
    if (hoursSinceSave > 30 * 24) {
      await clearRaceProgress();
      setSavedProgress(null);
      return;
    }
    setSavedProgress(saved);
  }, [user]);

  const resumeRace = useCallback(async () => {
    if (!savedProgress) return;
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
    await clearRaceProgress();
    setSavedProgress(null);
  }, []);

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
    if (codeTier === 'long') {
      setShowRaceTypeModal(true);
    } else {
      setRaceType('short');
      setShowWatchVideosModal(true);
    }
  };

  const selectRaceType = (type) => {
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
    if (welcomeVideoRef.current) await welcomeVideoRef.current.pauseAsync();
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
    if (finishVideoRef.current) await finishVideoRef.current.pauseAsync();
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    setFinishVideoEnded(true);
  };

  // ── Start Race ─────────────────────────────────────────────────────────────
  const startRace = () => {
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

      if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
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
    setVideoWatched({}); setVideoLoadErrors({}); setShowTextFallback({});
  };

  // ── Submit answer ──────────────────────────────────────────────────────────
  const submitAnswer = async () => {
    const q = belgradeQuestions[currentQuestion];
    const vKey = `${currentQuestion}-0`;
    if (q.videos && q.videos.length > 0 && !videoWatched[vKey] && !showTextFallback[vKey]) {
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
      if (photoUri) await saveFileToDatabase(photoUri, `${basePath}/picture`).catch(e => console.warn('Photo upload failed silently:', e));
      if (videoUri) await saveFileToDatabase(videoUri, `${basePath}/video`).catch(e => console.warn('Video upload failed silently:', e));
      if (currentQuestion === belgradeQuestions.length - 1) {
        const stopped = elapsedTime;
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
      Alert.alert(t('uploadFailed'), t('uploadFailedMsg'));
    } finally {
      setIsUploading(false);
    }
  };

  // ── Save results ───────────────────────────────────────────────────────────
  const saveResults = async (time) => {
    if (!user) return;
    try {
      await push(ref(db, `users/${user.uid}/results/races`), {
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
      { text: t('exitConfirm'), style: 'destructive', onPress: async () => { saveCurrentProgress(); resetAll(); setTimeout(() => checkSavedProgress(), 100); } },
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
    setVideoWatched({}); setVideoLoadErrors({});
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
            onPress={() => setClueVisible(v => !v)}
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
        source={require('../../assets/LogoDark.png')}
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
          <Video
            ref={welcomeVideoRef}
            source={V.welcome}
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
                  <TouchableOpacity style={styles.backButton} onPress={() => {
                    Object.values(videoStallTimers.current).forEach(t => t && clearTimeout(t));
                    videoStallTimers.current = {};
                    setShowTextFallback({});
                    setVideoLoadErrors({});
                    setCurrentQuestion(currentQuestion - 1);
                  }}>
                    <Text style={styles.backButtonText}>{isRTL ? '→' : '←'} {t('backButton')}</Text>
                  </TouchableOpacity>
                )}
                {currentQuestion < furthestQuestion && (
                  <TouchableOpacity style={styles.nextButton} onPress={() => {
                    Object.values(videoStallTimers.current).forEach(t => t && clearTimeout(t));
                    videoStallTimers.current = {};
                    setShowTextFallback({});
                    setVideoLoadErrors({});
                    setCurrentQuestion(currentQuestion + 1);
                  }}>
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
                const errCount = videoLoadErrors[vKey] || 0;
                const showFallback = showTextFallback[vKey];
                return (
                  <View key={`${currentQuestion}-${i}`} style={styles.videoWrapper}>
                    {showFallback ? (
                      <View style={styles.videoFallback}>
                        <Text style={styles.videoFallbackIcon}>⚠</Text>
                        <Text style={styles.videoFallbackText}>{t('noConnectionMsg')}</Text>
                      </View>
                    ) : (
                      <Video
                        source={src} style={styles.mediaVideo}
                        useNativeControls resizeMode={ResizeMode.CONTAIN} shouldPlay={false}
                        onFullscreenUpdate={({ fullscreenUpdate }) => {
                          if (fullscreenUpdate === Video.FULLSCREEN_UPDATE_PLAYER_WILL_PRESENT) {
                            ScreenOrientation.unlockAsync();
                          } else if (fullscreenUpdate === Video.FULLSCREEN_UPDATE_PLAYER_WILL_DISMISS) {
                            ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
                          }
                        }}
                        onPlaybackStatusUpdate={(status) => {
                          if (status.isLoaded && status.durationMillis > 0) {
                            if (!isWatched) {
                              const pct = status.positionMillis / status.durationMillis;
                              if (pct >= 0.9 || status.didJustFinish) {
                                setVideoWatched(prev => ({ ...prev, [vKey]: true }));
                              }
                            }
                            if (status.isPlaying) {
                              const pos = status.positionMillis;
                              if (videoLastProgress.current[vKey] === pos) {
                                if (!videoStallTimers.current[vKey]) {
                                  videoStallTimers.current[vKey] = setTimeout(() => {
                                    setShowTextFallback(prev => ({ ...prev, [vKey]: true }));
                                  }, 15000);
                                }
                              } else {
                                videoLastProgress.current[vKey] = pos;
                                if (videoStallTimers.current[vKey]) {
                                  clearTimeout(videoStallTimers.current[vKey]);
                                  videoStallTimers.current[vKey] = null;
                                }
                              }
                            }
                          } else if (status.isBuffering && status.positionMillis > 0) {
                            if (!videoStallTimers.current[vKey]) {
                              videoStallTimers.current[vKey] = setTimeout(() => {
                                setShowTextFallback(prev => ({ ...prev, [vKey]: true }));
                              }, 15000);
                            }
                          }
                        }}
                        onError={() => {
                          const newCount = errCount + 1;
                          setVideoLoadErrors(prev => ({ ...prev, [vKey]: newCount }));
                          if (newCount >= 2) {
                            setShowTextFallback(prev => ({ ...prev, [vKey]: true }));
                          }
                        }}
                      />
                    )}
                    {isWatched && (
                      <View style={styles.watchedBadge}>
                        <Text style={styles.watchedBadgeText}>✓ {t('videoWatched')}</Text>
                      </View>
                    )}
                    {errCount >= 2 && !showFallback && (
                      <TouchableOpacity
                        style={styles.showInstructionsBtn}
                        onPress={() => setShowTextFallback(prev => ({ ...prev, [vKey]: true }))}
                      >
                        <Text style={styles.showInstructionsBtnText}>{t('showInstructions')}</Text>
                      </TouchableOpacity>
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
              <Video
                ref={finishVideoRef}
                source={V.final}
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
  brandTitle: { fontSize: 38, fontFamily: F.display, color: C.onSurface, letterSpacing: 0.5, marginBottom: 6, textAlign: 'left', alignSelf: 'flex-start' },
  brandSubtitle: { fontSize: 11, fontFamily: F.semi, color: C.blue, letterSpacing: 5, textTransform: 'uppercase', marginBottom: 44, alignSelf: 'flex-start' },
  primaryButton: { width: '100%', paddingVertical: 18, borderRadius: R.md, backgroundColor: C.accent, borderWidth: BW.card, borderColor: C.outline, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  buttonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: C.onAccent, fontSize: 14, fontFamily: F.bold, letterSpacing: 3, textTransform: 'uppercase' },
  rulesLink: { marginTop: 4 },
  rulesLinkText: { fontSize: 11, fontFamily: F.semi, color: C.onVariant, letterSpacing: 3, textTransform: 'uppercase', textDecorationLine: 'underline' },

  modalOverlay: { flex: 1, backgroundColor: C.scrim, justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', backgroundColor: C.surfaceLow, borderRadius: R.lg, padding: 24, borderWidth: BW.card, borderColor: C.outline },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 17, fontFamily: F.display, color: C.onSurface, letterSpacing: 1 },
  modalClose: { fontSize: 18, color: C.onVariant, fontFamily: F.bold },
  modalSubtext: { fontSize: 13, fontFamily: F.body, color: C.onVariant, marginBottom: 20, lineHeight: 20 },
  fieldLabel: { fontSize: 11, fontFamily: F.semi, color: C.onVariant, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 },
  codeInput: { backgroundColor: C.surfaceBright, borderWidth: BW.card, borderColor: C.outline, borderRadius: R.md, paddingHorizontal: 16, paddingVertical: 14, fontSize: 22, fontFamily: F.bold, color: C.onSurface, letterSpacing: 6, marginBottom: 20, textAlign: 'center' },
  codeInputFocused: { backgroundColor: C.goldSoft, borderColor: C.gold },
  rulesScroll: { maxHeight: 300, marginBottom: 8 },
  rulesText: { fontSize: 15, fontFamily: F.body, color: C.onVariant, lineHeight: 24 },
  cityButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.blue, borderRadius: R.md, paddingVertical: 18, paddingHorizontal: 20, marginBottom: 10, borderWidth: BW.card, borderColor: C.outline },
  cityButtonText: { flex: 1, fontSize: 16, fontFamily: F.bold, color: C.onAccent, letterSpacing: 2 },
  cityChevron: { fontSize: 22, color: C.onAccent, fontFamily: F.bold },

  videoFullScreen: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  fullScreenVideo: { width: '100%', height: '100%', position: 'absolute' },
  skipButton: { position: 'absolute', top: 55, right: 24, backgroundColor: C.scrim, paddingHorizontal: 18, paddingVertical: 10, borderRadius: R.pill, borderWidth: 1, borderColor: C.onSurfaceFaint },
  skipButtonText: { color: C.onDark, fontSize: 14, fontFamily: F.semi, letterSpacing: 1 },
  startRaceContainer: { position: 'absolute', bottom: 60, alignSelf: 'center' },
  startRaceButton: { backgroundColor: C.accent, paddingVertical: 18, paddingHorizontal: 50, borderRadius: R.md, borderWidth: BW.card, borderColor: C.outline },
  startRaceButtonText: { color: C.onAccent, fontSize: 16, fontFamily: F.bold, letterSpacing: 3 },

  gameContainer: { flex: 1, backgroundColor: C.base },
  gameHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 55, paddingHorizontal: 20, paddingBottom: 14, backgroundColor: C.surfaceLow, borderBottomWidth: 3, borderBottomColor: C.outline },
  timerContainer: { backgroundColor: C.gold, paddingHorizontal: 16, paddingVertical: 8, borderRadius: R.md, borderWidth: BW.card, borderColor: C.outline },
  timerLabel: { fontSize: 9, fontFamily: F.semi, color: C.onSurface, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 2 },
  timerText: { fontSize: 22, fontFamily: F.display, color: C.onSurface, letterSpacing: 1 },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  backButton: { backgroundColor: C.surfaceBright, paddingHorizontal: 10, paddingVertical: 9, borderRadius: R.xs, borderWidth: BW.thin, borderColor: C.outline },
  backButtonText: { color: C.onSurface, fontSize: 10, fontFamily: F.semi, letterSpacing: 0.5 },
  nextButton: { backgroundColor: C.goldSoft, paddingHorizontal: 10, paddingVertical: 9, borderRadius: R.xs, borderWidth: BW.thin, borderColor: C.outline },
  nextButtonText: { color: C.onSurface, fontSize: 10, fontFamily: F.semi, letterSpacing: 0.5 },
  exitButton: { backgroundColor: C.accent, paddingHorizontal: 18, paddingVertical: 10, borderRadius: R.xs, borderWidth: BW.thin, borderColor: C.outline },
  exitButtonText: { color: C.onAccent, fontSize: 13, fontFamily: F.bold, letterSpacing: 2 },

  gameScroll: { flex: 1 },
  gameScrollContent: { padding: 20, paddingBottom: 60 },
  questionNumber: { fontSize: 11, fontFamily: F.semi, color: C.onVariant, marginBottom: 6, letterSpacing: 3, textTransform: 'uppercase' },
  missionTitle: { fontSize: 24, fontFamily: F.display, color: C.onSurface, marginBottom: 20, letterSpacing: 0.3, lineHeight: 30 },
  mediaVideo: { width: '100%', height: 220, borderRadius: R.md, marginBottom: 16, backgroundColor: '#000', borderWidth: BW.card, borderColor: C.outline },
  mediaImage: { width: '100%', height: 220, borderRadius: R.md, marginBottom: 16, backgroundColor: C.surfaceHigh, borderWidth: BW.card, borderColor: C.outline },
  questionText: { fontSize: 15, fontFamily: F.body, color: C.onSurface, marginBottom: 24, lineHeight: 24 },
  answerInput: { backgroundColor: C.surfaceBright, borderWidth: BW.card, borderColor: C.outline, borderRadius: R.md, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, fontFamily: F.body, color: C.onSurface, marginBottom: 10 },
  answerInputFocused: { backgroundColor: C.goldSoft, borderColor: C.gold },
  errorText: { color: C.dangerText, fontSize: 13, fontFamily: F.semi, marginBottom: 12, letterSpacing: 0.3 },

  mediaCapture: { marginBottom: 16 },
  captureButton: { backgroundColor: C.surfaceBright, paddingVertical: 14, paddingHorizontal: 20, borderRadius: R.md, alignItems: 'center', marginBottom: 10, borderWidth: BW.card, borderColor: C.outline },
  captureButtonText: { color: C.onSurface, fontSize: 15, fontFamily: F.semi },
  previewImage: { width: '100%', height: 200, borderRadius: R.md, marginTop: 6, borderWidth: BW.card, borderColor: C.outline },
  videoConfirm: { color: C.success, fontSize: 14, fontFamily: F.semi, textAlign: 'center', marginTop: 6, letterSpacing: 1 },

  clueBlock: { marginBottom: 16 },
  clueButton: { backgroundColor: C.gold, borderWidth: BW.card, borderColor: C.outline, borderRadius: R.md, paddingVertical: 13, paddingHorizontal: 20, alignItems: 'center' },
  clueButtonText: { color: C.onSurface, fontSize: 12, fontFamily: F.bold, letterSpacing: 2 },
  clueCard: { marginTop: 10, backgroundColor: C.goldSoft, borderRadius: R.md, borderWidth: BW.thin, borderColor: C.outline, borderLeftWidth: 6, borderLeftColor: C.gold, padding: 14 },
  clueLabel: { fontSize: 9, fontFamily: F.semi, color: C.onVariant, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 },
  clueText: { fontSize: 14, fontFamily: F.body, color: C.onSurface, lineHeight: 22 },

  uploadingContainer: { alignItems: 'center', marginVertical: 24 },
  uploadingText: { color: C.onVariant, fontSize: 11, fontFamily: F.semi, marginTop: 12, letterSpacing: 3, textTransform: 'uppercase' },

  endResultsContainer: { flex: 1, backgroundColor: C.base, justifyContent: 'center', alignItems: 'center', padding: 32, width: '100%' },
  endTrophy: { fontSize: 72, marginBottom: 16 },
  endCongrats: { fontSize: 18, fontFamily: F.semi, color: C.accent, textAlign: 'center', marginBottom: 12, lineHeight: 26 },
  endTitle: { fontSize: 34, fontFamily: F.display, color: C.onSurface, letterSpacing: 1.5, marginBottom: 6, textTransform: 'uppercase' },
  endCity: { fontSize: 13, fontFamily: F.semi, color: C.blue, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 36 },
  endTimeCard: { backgroundColor: C.gold, borderRadius: R.lg, borderWidth: BW.card, borderColor: C.outline, paddingVertical: 22, paddingHorizontal: 40, alignItems: 'center', marginBottom: 36, width: '100%' },
  endTimeLabel: { fontSize: 11, fontFamily: F.semi, color: C.onSurface, letterSpacing: 3, marginBottom: 8, textTransform: 'uppercase' },
  endTimeValue: { fontSize: 46, fontFamily: F.display, color: C.onSurface, letterSpacing: 1 },

  logo: { width: 200, height: 200, marginBottom: 25 },

  resumeBlock: { width: '100%', marginBottom: 16 },
  resumeButton: { width: '100%', paddingVertical: 16, paddingHorizontal: 18, borderRadius: R.md, backgroundColor: C.surfaceLow, borderWidth: BW.card, borderColor: C.outline, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  resumeButtonText: { color: C.onSurface, fontSize: 14, fontFamily: F.bold, letterSpacing: 3, textTransform: 'uppercase' },
  resumeInfo: { color: C.onVariant, fontSize: 11, fontFamily: F.semi, letterSpacing: 1, marginTop: 6 },
  dismissButton: { alignSelf: 'center', paddingVertical: 8 },
  dismissButtonText: { fontSize: 12, fontFamily: F.semi, color: C.onVariant, letterSpacing: 2, textTransform: 'uppercase', textDecorationLine: 'underline' },

  raceTypeScreen: { flex: 1, backgroundColor: C.base, justifyContent: 'center', alignItems: 'center', padding: 28 },
  raceTypeScreenTitle: { fontSize: 28, fontFamily: F.display, color: C.onSurface, letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },
  raceTypeScreenSub: { fontSize: 14, fontFamily: F.body, color: C.onVariant, lineHeight: 22, textAlign: 'center', marginBottom: 36, paddingHorizontal: 12 },
  raceTypeButton: { width: '100%', paddingVertical: 28, paddingHorizontal: 24, borderRadius: R.lg, marginBottom: 16, borderWidth: BW.card, borderColor: C.outline, alignItems: 'center' },
  raceTypeShort: { backgroundColor: C.goldSoft },
  raceTypeLong: { backgroundColor: C.surfaceLow },
  raceTypeEmoji: { fontSize: 36, marginBottom: 12 },
  raceTypeLabel: { fontSize: 20, fontFamily: F.display, color: C.onSurface, letterSpacing: 1.5, textTransform: 'uppercase' },
  raceTypeDivider: { width: 40, height: 3, backgroundColor: C.outline, borderRadius: 2, marginVertical: 12 },
  raceTypeDesc: { fontSize: 14, fontFamily: F.body, color: C.onVariant, letterSpacing: 0.5, lineHeight: 20, textAlign: 'center' },
  raceTypeBack: { marginTop: 12, paddingVertical: 10 },
  raceTypeBackText: { fontSize: 13, fontFamily: F.semi, color: C.onVariant, letterSpacing: 2, textTransform: 'uppercase', textDecorationLine: 'underline' },

  watchVideosScreen: { flex: 1, backgroundColor: C.base, justifyContent: 'center', alignItems: 'center', padding: 36 },
  watchVideosIcon: { fontSize: 64, marginBottom: 28 },
  watchVideosTitle: { fontSize: 32, fontFamily: F.display, color: C.onSurface, letterSpacing: 1.5, marginBottom: 20, textTransform: 'uppercase' },
  watchVideosMessage: { fontSize: 17, fontFamily: F.body, color: C.onSurface, lineHeight: 28, textAlign: 'center', marginBottom: 48 },
  watchVideosButton: { width: '100%', paddingVertical: 20, borderRadius: R.md, backgroundColor: C.accent, borderWidth: BW.card, borderColor: C.outline, alignItems: 'center' },
  watchVideosButtonText: { color: C.onAccent, fontSize: 14, fontFamily: F.bold, letterSpacing: 3, textTransform: 'uppercase' },

  videoWrapper: { marginBottom: 16, position: 'relative' },
  watchedBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: C.gold, paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill, borderWidth: BW.thin, borderColor: C.outline },
  watchedBadgeText: { color: C.onSurface, fontSize: 11, fontFamily: F.bold, letterSpacing: 1 },
  videoFallback: { width: '100%', height: 220, borderRadius: R.md, backgroundColor: C.surfaceHigh, justifyContent: 'center', alignItems: 'center', padding: 20, borderWidth: BW.card, borderColor: C.outline },
  videoFallbackIcon: { fontSize: 32, marginBottom: 10 },
  videoFallbackText: { fontSize: 14, fontFamily: F.body, color: C.onVariant, textAlign: 'center', lineHeight: 20 },
  showInstructionsBtn: { marginTop: 8, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16, backgroundColor: C.goldSoft, borderRadius: R.xs, borderWidth: BW.thin, borderColor: C.outline },
  showInstructionsBtnText: { color: C.onSurface, fontSize: 12, fontFamily: F.semi, letterSpacing: 2 },

  feedbackButton: { width: '100%', paddingVertical: 14, borderRadius: R.md, borderWidth: BW.thin, borderColor: C.outline, alignItems: 'center', marginTop: 4 },
  feedbackButtonText: { color: C.onSurface, fontSize: 13, fontFamily: F.semi, letterSpacing: 2, textTransform: 'uppercase' },
  feedbackSubtext: { color: C.onVariant, fontSize: 13, fontFamily: F.body, marginTop: 10, textAlign: 'center', letterSpacing: 0.3 },
});
