// constants/theme.js
//
// The Big Race Belgrade — "Bright Poster" design tokens.
//
// Single source of truth for colour, type and shape. Every screen imports from
// here. Do not redeclare a palette inside a screen file: that is what this
// file replaced, and it had already drifted between screens.
//
// The ground is Knez Mihailova sandstone, so the app reads in direct sunlight —
// which is where the race actually happens — and so the logo, which is drawn
// for a light ground, finally sits on one. Cards are near-white with a heavy
// near-black outline: the look is a printed poster or a sticker, which is where
// the logo's own vocabulary comes from.
//
// Two rules the whole app obeys:
//   red  = something you press
//   gold = time and winning
// Nothing else is allowed to be loud.

export const C = {
  // ── Grounds ────────────────────────────────────────────────────────────────
  base:          '#F4E7CE', // sandstone — the page itself
  surfaceLow:    '#FFFDF7', // cards sitting on the page
  surfaceHigh:   '#E3D2B0', // inset wells, secondary fills
  surfaceBright: '#FFFFFF',
  outline:       '#1A1512', // the heavy poster border
  outlineSoft:   '#D3BF9B', // dividers where a black rule would shout

  // ── Text ───────────────────────────────────────────────────────────────────
  onSurface:     '#1A1512',
  onVariant:     '#7A6E5C',
  onAccent:      '#FFF8EC',
  onDark:        '#FFF8EC', // chrome that sits over video, always a dark bed

  // ── Roles ──────────────────────────────────────────────────────────────────
  accent:        '#C6363C', // actions: primary buttons, exit, your row
  accentSoft:    '#F6DCDC',
  gold:          '#E5A823', // time, clues, first place, victory
  goldSoft:      '#FBEEC9',
  blue:          '#1C4F8C', // the third flag colour — the city itself

  danger:        '#F6DCDC',
  dangerText:    '#A32027',
  success:       '#1F7A4D',

  silver:        '#8E9AA0',
  bronze:        '#A8703C',
  dim:           '#B8A98E',

  scrim:         'rgba(26,21,18,0.62)',
  // Translucent light — for chrome over video, where the backdrop is arbitrary
  // and a solid border would fight the footage.
  onSurfaceFaint:'rgba(255,248,236,0.35)',

  // ── Legacy aliases ─────────────────────────────────────────────────────────
  // Screens used to reference C.primary / C.secondary for a dozen unrelated
  // roles. Kept mapped so any call site missed during a re-skin still lands
  // inside the palette instead of falling back to an old colour.
  primary:       '#E5A823',
  secondary:     '#C6363C',
};

// Rubik is the one family here that covers Latin, Hebrew and Cyrillic in the
// same file, so English, עברית and српски all render in the real brand face
// instead of falling back to the system font.
//
// Note: when fontFamily is set, do NOT also set fontWeight — Android picks the
// wrong face and iOS synthesises a fake bold. The weight lives in the family
// name.
export const F = {
  display: 'Rubik_900Black',     // screen titles, mission titles, the timer
  bold:    'Rubik_800ExtraBold', // buttons, ranks, stat values
  semi:    'Rubik_600SemiBold',  // eyebrows, field labels, pills
  medium:  'Rubik_500Medium',    // menu rows
  body:    'Rubik_400Regular',   // paragraphs, mission text
};

export const R = {
  xs:   8,
  sm:  10,
  md:  14,
  lg:  18,
  xl:  22,
  pill: 999,
};

// Border weights. The heavy one is the poster outline and is deliberately
// thick — thinning it is what makes the design look generic again.
export const BW = {
  thin: 1.5,
  card: 2.5,
};
