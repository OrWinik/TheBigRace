// i18n/index.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { I18nManager } from 'react-native';

// ─── Translations ─────────────────────────────────────────────────────────────
const translations = {
  en: {
    // Profile
    totalRaces:       'TOTAL RACES',
    bestTime:         'BEST TIME',
    settings:         'SETTINGS',
    gameHistory:      'Game History',
    language:         'Language',
    contactUs:        'Contact Us',
    termsOfUse:       'Terms of Use',
    deleteAccount:    'Delete Account',
    signOut:          'SIGN OUT',

    // Race History Modal
    raceHistory:      'RACE HISTORY',
    noRaces:          'No races completed yet.',
    unknown:          'Unknown',

    // Language Modal
    languageTitle:    'LANGUAGE',

    // Delete Modal
    deleteTitle:      'DELETE ACCOUNT',
    deleteWarning:    'This action is permanent and cannot be undone. All your race data will be lost.',
    deleteConfirm:    'YES, DELETE MY ACCOUNT',
    cancel:           'Cancel',

    // Alerts
    permissionNeeded: 'Permission needed',
    permissionMsg:    'Please allow access to your photo library.',
    imageTooLarge:    'Image too large',
    imageTooLargeMsg: 'Please select a smaller image.',
    error:            'Error',
    deleteError:      'Could not delete account. Please re-login and try again.',

    // Auth - Sign In
    signIn:               'Sign In',
    signInButton:         'SIGN IN',
    login:                'Login',
    loginSubheading:      'Use your credentials to enter.',
    emailAddress:         'EMAIL ADDRESS',
    password:             'Password',
    forgotPassword:       'Forgot password?',
    noAccount:            "Don't have an account?",
    incorrectCredentials: 'Incorrect credentials',
    resetPassword:        'Reset Password',
    resetPasswordBody:    'Enter your registered email to receive a reset link.',
    sendResetLink:        'SEND RESET LINK',
    resetLinkSent:        'Reset link sent to your email',
    invalidEmail:         'Invalid email',

    // Auth - Sign Up
    signUp:             'Sign Up',
    createAccount:      'CREATE ACCOUNT',
    confirmPassword:    'Confirm Password',
    usernameLabel:      'USERNAME',
    emailTerminal:      'EMAIL TERMINAL',
    passwordLabel:      'PASSWORD',
    haveAccount:        'ALREADY HAVE AN ACCOUNT?',
    signInLink:         'SIGN IN',
    email:              'Email',
    usernameRequired:   'Username is required',
    passwordsNoMatch:   'Passwords do not match',
    invalidEmailOrPass: 'Invalid email or password',
    purchaseEmailNote:  'Use the same email you entered to purchase the game',

    // Home / Game
    play:               'PLAY',
    leaderboard:        'LEADERBOARD',
    profile:            'PROFILE',
    selectCourse:       'SELECT COURSE',
    startRace:          'START RACE',
    startRaceButton:    'START RACE',
    bestTimeLabel:      'Best Time',
    yourTime:           'YOUR TIME',
    raceComplete:       'RACE COMPLETE',
    newBest:            'NEW BEST!',
    tryAgain:           'TRY AGAIN',
    home:               'HOME',
    rank:               'RANK',
    player:             'PLAYER',
    time:               'TIME',
    brandSubtitle:      'Racing Game',
    enterCode:          'ENTER CODE',
    startGame:          'START GAME',
    gameRules:          'GAME RULES',
    gameRulesTitle:     'GAME RULES',
    enterCodeTitle:     'ENTER CODE',
    enterCodeSubtext:   'Enter the code sent to your email to begin the race.',
    raceCodeLabel:      '# RACE CODE',
    initialize:         'INITIALIZE',
    selectCircuit:      'SELECT CIRCUIT',
    selectCircuitSub:   'Choose your city to begin.',
    missionLabel:       'MISSION',
    of:                 'of',
    timerLabel:         'TIME',
    exit:               'EXIT',
    exitTitle:          'Exit Game',
    exitMessage:        "Are you sure you want to exit? Your progress won't be saved.",
    stay:               'Stay',
    exitConfirm:        'Exit',
    submit:             'SUBMIT',
    finishRace:         'FINISH RACE',
    backToHome:         'BACK TO HOME',
    finalTime:          'FINAL TIME',
    savingTelemetry:    'SAVING TELEMETRY...',
    enterAnswer:        'Enter your answer',
    wrongAnswer:        'Wrong answer — try again',
    takePhoto:          'Take Photo',
    retakePhoto:        'Retake Photo',
    recordVideo:        'Record Video',
    rerecordVideo:      'Re-record Video',
    videoReady:         'Video recorded — ready to submit',
    photoRequired:      'Photo required',
    photoRequiredMsg:   'Please take a photo before continuing.',
    videoRequired:      'Video required',
    videoRequiredMsg:   'Please record a video before continuing.',
    uploadFailed:       'Upload failed',
    uploadFailedMsg:    'Could not save your answer. Please try again.',
    errorEnterCode:     'Please enter a game code',
    invalidCode:        'Invalid Code',
    invalidCodeMsg:     'No game found with that code. Please check and try again.',
    dbError:            'Could not reach the database. Please try again.',
    validateError:      'Failed to validate code. Please try again.',
    saveError:          'Failed to save game results.',
    skip:               'Skip',
    permissionNeeded:   'Permission needed',
    cameraPermission:   'Camera permission is required to take a photo.',
    cameraVideoPermission: 'Camera permission is required to record a video.',
    belgradCircuit:     'Belgrade Circuit',

    // Leaderboard
    telemetryFeed:    'TELEMETRY LIVE FEED',
    globalRanking:    'GLOBAL RANKING',
    selectCity:       'SELECT CITY',
    loadingTelemetry: 'LOADING TELEMETRY...',
    noRaceData:       'NO RACE DATA FOR',
    beFirst:          'Be the first to complete this circuit.',
    you:              'YOU',
    globalRankLabel:  'GLOBAL RANKING',

    codeFull: "This code's group is already full.",
    codeExpired: 'This code has expired.',

  },

  he: {
    // Profile
    totalRaces:       'סה״כ מירוצים',
    bestTime:         'שיא אישי',
    settings:         'הגדרות',
    gameHistory:      'היסטוריית משחקים',
    language:         'שפה',
    contactUs:        'צור קשר',
    termsOfUse:       'תנאי שימוש',
    deleteAccount:    'מחק חשבון',
    signOut:          'התנתק',

    // Race History Modal
    raceHistory:      'היסטוריית מירוצים',
    noRaces:          'עדיין לא הושלמו מירוצים.',
    unknown:          'לא ידוע',

    // Language Modal
    languageTitle:    'שפה',

    // Delete Modal
    deleteTitle:      'מחיקת חשבון',
    deleteWarning:    'פעולה זו היא סופית ולא ניתן לבטלה. כל נתוני המירוצים שלך יאבדו.',
    deleteConfirm:    'כן, מחק את החשבון שלי',
    cancel:           'ביטול',

    // Alerts
    permissionNeeded: 'נדרשת הרשאה',
    permissionMsg:    'אנא אפשר גישה לספריית התמונות שלך.',
    imageTooLarge:    'התמונה גדולה מדי',
    imageTooLargeMsg: 'אנא בחר תמונה קטנה יותר.',
    error:            'שגיאה',
    deleteError:      'לא ניתן למחוק את החשבון. אנא התחבר מחדש ונסה שוב.',

    // Auth - Sign In
    signIn:               'כניסה',
    signInButton:         'כניסה',
    login:                'התחברות',
    loginSubheading:      'השתמש בפרטים שלך כדי להיכנס.',
    emailAddress:         'כתובת אימייל',
    password:             'סיסמה',
    forgotPassword:       'שכחת סיסמה?',
    noAccount:            'אין לך חשבון?',
    incorrectCredentials: 'פרטים שגויים',
    resetPassword:        'איפוס סיסמה',
    resetPasswordBody:    'הזן את האימייל הרשום שלך כדי לקבל קישור לאיפוס.',
    sendResetLink:        'שלח קישור לאיפוס',
    resetLinkSent:        'קישור לאיפוס נשלח לאימייל שלך',
    invalidEmail:         'אימייל לא תקין',

    // Auth - Sign Up
    signUp:             'הרשמה',
    createAccount:      'צור חשבון',
    confirmPassword:    'אימות סיסמה',
    usernameLabel:      'שם משתמש',
    emailTerminal:      'כתובת אימייל',
    passwordLabel:      'סיסמה',
    haveAccount:        'כבר יש לך חשבון?',
    signInLink:         'כניסה',
    email:              'אימייל',
    usernameRequired:   'שם משתמש נדרש',
    passwordsNoMatch:   'הסיסמאות אינן תואמות',
    invalidEmailOrPass: 'אימייל או סיסמה לא תקינים',
    purchaseEmailNote:  'השתמש באותו אימייל שהזנת בעת רכישת המשחק',

    // Home / Game
    play:               'שחק',
    leaderboard:        'טבלת דירוג',
    profile:            'פרופיל',
    selectCourse:       'בחר מסלול',
    startRace:          'התחל מירוץ',
    startRaceButton:    'התחל מירוץ',
    bestTimeLabel:      'שיא אישי',
    yourTime:           'הזמן שלך',
    raceComplete:       'המירוץ הסתיים',
    newBest:            'שיא חדש!',
    tryAgain:           'נסה שוב',
    home:               'בית',
    rank:               'דירוג',
    player:             'שחקן',
    time:               'זמן',
    brandSubtitle:      'משחק מירוץ',
    enterCode:          'הזן קוד',
    startGame:          'התחל משחק',
    gameRules:          'חוקי המשחק',
    gameRulesTitle:     'חוקי המשחק',
    enterCodeTitle:     'הזן קוד',
    enterCodeSubtext:   'הזן את הקוד שנשלח לאימייל שלך כדי להתחיל במירוץ.',
    raceCodeLabel:      '# קוד מירוץ',
    initialize:         'אתחל',
    selectCircuit:      'בחר מסלול',
    selectCircuitSub:   'בחר את העיר שלך כדי להתחיל.',
    missionLabel:       'משימה',
    of:                 'מתוך',
    timerLabel:         'זמן',
    exit:               'יציאה',
    exitTitle:          'יציאה מהמשחק',
    exitMessage:        'האם אתה בטוח שברצונך לצאת? ההתקדמות שלך לא תישמר.',
    stay:               'הישאר',
    exitConfirm:        'צא',
    submit:             'שלח',
    finishRace:         'סיים מירוץ',
    backToHome:         'חזור לדף הבית',
    finalTime:          'זמן סופי',
    savingTelemetry:    '...שומר נתונים',
    enterAnswer:        'הזן את תשובתך',
    wrongAnswer:        'תשובה שגויה — נסה שוב',
    takePhoto:          'צלם תמונה',
    retakePhoto:        'צלם שוב',
    recordVideo:        'הקלט וידאו',
    rerecordVideo:      'הקלט שוב',
    videoReady:         'וידאו הוקלט — מוכן לשליחה',
    photoRequired:      'נדרשת תמונה',
    photoRequiredMsg:   'אנא צלם תמונה לפני המשך.',
    videoRequired:      'נדרש וידאו',
    videoRequiredMsg:   'אנא הקלט וידאו לפני המשך.',
    uploadFailed:       'שגיאת העלאה',
    uploadFailedMsg:    'לא ניתן לשמור את תשובתך. אנא נסה שוב.',
    errorEnterCode:     'אנא הזן קוד משחק',
    invalidCode:        'קוד לא תקין',
    invalidCodeMsg:     'לא נמצא משחק עם קוד זה. אנא בדוק ונסה שוב.',
    dbError:            'לא ניתן להתחבר למסד הנתונים. אנא נסה שוב.',
    validateError:      'אימות הקוד נכשל. אנא נסה שוב.',
    saveError:          'שמירת תוצאות המשחק נכשלה.',
    skip:               'דלג',
    cameraPermission:   'נדרשת הרשאת מצלמה לצילום תמונה.',
    cameraVideoPermission: 'נדרשת הרשאת מצלמה להקלטת וידאו.',
    belgradCircuit:     'מסלול בלגרד',

    // Leaderboard
    telemetryFeed:    'שידור חי',
    globalRanking:    'דירוג עולמי',
    selectCity:       'בחר עיר',
    loadingTelemetry: '...טוען נתונים',
    noRaceData:       'אין נתוני מירוץ עבור',
    beFirst:          'היה הראשון לסיים את המסלול הזה.',
    you:              'אתה',
    globalRankLabel:  'דירוג עולמי',
    codeFull: "הקבוצה לקוד זה כבר מלאה.",
    codeExpired: 'קוד זה פג תוקף.',

  },

  sr: {
    // Profile
    totalRaces:       'UKUPNO TRKA',
    bestTime:         'NAJBOLJE VREME',
    settings:         'PODEŠAVANJA',
    gameHistory:      'Istorija igre',
    language:         'Jezik',
    contactUs:        'Kontaktirajte nas',
    termsOfUse:       'Uslovi korišćenja',
    deleteAccount:    'Obriši nalog',
    signOut:          'ODJAVI SE',

    // Race History Modal
    raceHistory:      'ISTORIJA TRKA',
    noRaces:          'Još nema završenih trka.',
    unknown:          'Nepoznato',

    // Language Modal
    languageTitle:    'JEZIK',

    // Delete Modal
    deleteTitle:      'BRISANJE NALOGA',
    deleteWarning:    'Ova radnja je trajna i ne može se poništiti. Svi podaci o trkama biće izgubljeni.',
    deleteConfirm:    'DA, OBRIŠI MOJ NALOG',
    cancel:           'Otkaži',

    // Alerts
    permissionNeeded: 'Potrebna dozvola',
    permissionMsg:    'Molimo dozvolite pristup vašoj galeriji.',
    imageTooLarge:    'Slika je prevelika',
    imageTooLargeMsg: 'Molimo izaberite manju sliku.',
    error:            'Greška',
    deleteError:      'Nije moguće obrisati nalog. Molimo prijavite se ponovo i pokušajte opet.',

    // Auth - Sign In
    signIn:               'Prijava',
    signInButton:         'PRIJAVA',
    login:                'Prijava',
    loginSubheading:      'Unesite vaše podatke za pristup.',
    emailAddress:         'EMAIL ADRESA',
    password:             'Lozinka',
    forgotPassword:       'Zaboravili ste lozinku?',
    noAccount:            'Nemate nalog?',
    incorrectCredentials: 'Pogrešni podaci',
    resetPassword:        'Resetovanje lozinke',
    resetPasswordBody:    'Unesite registrovani email da biste dobili link za resetovanje.',
    sendResetLink:        'POŠALJI LINK',
    resetLinkSent:        'Link za resetovanje je poslat na vaš email',
    invalidEmail:         'Nevažeći email',

    // Auth - Sign Up
    signUp:             'Registracija',
    createAccount:      'KREIRAJ NALOG',
    confirmPassword:    'Potvrdi lozinku',
    usernameLabel:      'KORISNIČKO IME',
    emailTerminal:      'EMAIL ADRESA',
    passwordLabel:      'LOZINKA',
    haveAccount:        'VEĆ IMATE NALOG?',
    signInLink:         'PRIJAVA',
    email:              'Email',
    usernameRequired:   'Korisničko ime je obavezno',
    passwordsNoMatch:   'Lozinke se ne podudaraju',
    invalidEmailOrPass: 'Nevažeći email ili lozinka',
    purchaseEmailNote:  'Koristite isti email koji ste uneli pri kupovini igre',

    // Home / Game
    play:               'IGRAJ',
    leaderboard:        'RANG LISTA',
    profile:            'PROFIL',
    selectCourse:       'IZABERITE STAZU',
    startRace:          'POČNI TRKU',
    startRaceButton:    'POČNI TRKU',
    bestTimeLabel:      'Najbolje vreme',
    yourTime:           'VAŠE VREME',
    raceComplete:       'TRKA ZAVRŠENA',
    newBest:            'NOVI REKORD!',
    tryAgain:           'POKUŠAJ PONOVO',
    home:               'POČETNA',
    rank:               'MESTO',
    player:             'IGRAČ',
    time:               'VREME',
    brandSubtitle: 'Trkaća igra',
    enterCode:          'UNESI KOD',
    startGame:          'POČNI IGRU',
    gameRules:          'PRAVILA IGRE',
    gameRulesTitle:     'PRAVILA IGRE',
    enterCodeTitle:     'UNESI KOD',
    enterCodeSubtext:   'Unesite kod koji ste dobili emailom da biste počeli trku.',
    raceCodeLabel:      '# KOD TRKE',
    initialize:         'INICIJALIZUJ',
    selectCircuit:      'IZABERI STAZU',
    selectCircuitSub:   'Izaberite grad da biste počeli.',
    missionLabel:       'MISIJA',
    of:                 'od',
    timerLabel:         'VREME',
    exit:               'IZLAZ',
    exitTitle:          'Izlaz iz igre',
    exitMessage:        'Da li ste sigurni da želite da izađete? Vaš napredak neće biti sačuvan.',
    stay:               'Ostani',
    exitConfirm:        'Izađi',
    submit:             'POTVRDI',
    finishRace:         'ZAVRŠI TRKU',
    backToHome:         'NAZAD NA POČETNU',
    finalTime:          'KRAJNJE VREME',
    savingTelemetry:    'ČUVANJE PODATAKA...',
    enterAnswer:        'Unesite odgovor',
    wrongAnswer:        'Pogrešan odgovor — pokušajte ponovo',
    takePhoto:          'Fotografišite',
    retakePhoto:        'Ponovo fotografišite',
    recordVideo:        'Snimite video',
    rerecordVideo:      'Ponovo snimite',
    videoReady:         'Video snimljen — spreman za slanje',
    photoRequired:      'Fotografija obavezna',
    photoRequiredMsg:   'Molimo fotografišite pre nastavka.',
    videoRequired:      'Video obavezan',
    videoRequiredMsg:   'Molimo snimite video pre nastavka.',
    uploadFailed:       'Greška pri otpremanju',
    uploadFailedMsg:    'Nije moguće sačuvati odgovor. Molimo pokušajte ponovo.',
    errorEnterCode:     'Molimo unesite kod igre',
    invalidCode:        'Nevažeći kod',
    invalidCodeMsg:     'Nije pronađena igra sa tim kodom. Proverite i pokušajte ponovo.',
    dbError:            'Nije moguće pristupiti bazi. Molimo pokušajte ponovo.',
    validateError:      'Provera koda nije uspela. Molimo pokušajte ponovo.',
    saveError:          'Čuvanje rezultata nije uspelo.',
    skip:               'Preskoči',
    cameraPermission:   'Potrebna dozvola kamere za fotografisanje.',
    cameraVideoPermission: 'Potrebna dozvola kamere za snimanje videa.',
    belgradCircuit:     'Beogradska staza',

    // Leaderboard
    telemetryFeed:    'TELEMETRIJA UŽIVO',
    globalRanking:    'GLOBALNI RANG',
    selectCity:       'IZABERI GRAD',
    loadingTelemetry: 'UČITAVANJE...',
    noRaceData:       'NEMA PODATAKA ZA',
    beFirst:          'Budite prvi koji završi ovu stazu.',
    you:              'TI',
    globalRankLabel:  'GLOBALNI RANG',

    codeFull: "Grupa za ovaj kod je već popunjena.",
    codeExpired: 'Ovaj kod je istekao.',

  },
};

// ─── Context ──────────────────────────────────────────────────────────────────
const LanguageContext = createContext();
const STORAGE_KEY = 'app_language';

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('en');
  const [loaded, setLoaded]     = useState(false);

  // Load saved language on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved && translations[saved]) {
          applyLanguage(saved, false);
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  const applyLanguage = (code, persist = true) => {
    const isRTL = code === 'he';

    // Only reload if RTL direction actually changes
    if (I18nManager.isRTL !== isRTL) {
      I18nManager.allowRTL(isRTL);
      I18nManager.forceRTL(isRTL);
      // In Expo you'd call Updates.reloadAsync() here if you want instant flip.
      // For now the flip applies on next app launch (or you can add expo-updates).
    }

    setLanguage(code);
    if (persist) AsyncStorage.setItem(STORAGE_KEY, code);
  };

  const t = (key) => translations[language]?.[key] ?? translations.en[key] ?? key;

  if (!loaded) return null; // wait for AsyncStorage before rendering

  return (
    <LanguageContext.Provider value={{ language, setLanguage: applyLanguage, t, isRTL: language === 'he' }}>
      {children}
    </LanguageContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useTranslation must be used inside <LanguageProvider>');
  return ctx;
}