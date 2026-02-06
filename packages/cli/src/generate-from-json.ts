/**
 * Generate design system files from tokens.json
 * Reads the Figma-exported JSON and produces:
 *  - tokens.css (CSS custom properties with light/dark themes)
 *  - tailwind.config.js
 *  - tokens.ts (TypeScript types)
 *  - theme-toggle.ts (theme utility)
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert camelCase token names to clean kebab-case CSS variable names.
 * Handles edge cases: AKA, consecutive capitals, numbers attached to words.
 */
function camelToKebab(str: string): string {
  return str
    // Insert hyphen before uppercase letters that follow lowercase letters
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    // Insert hyphen before uppercase letters that are followed by lowercase (for sequences like AKA→a-k-a)
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    // Insert hyphen before digits that follow letters
    .replace(/([a-zA-Z])(\d)/g, '$1-$2')
    // Insert hyphen before letters that follow digits
    .replace(/(\d)([a-zA-Z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Clean semantic token name: remove redundant prefixes, produce developer-friendly names.
 * Examples:
 *  colorsTextTextPrimary          → text-primary
 *  colorsBackgroundBgPrimary      → bg-primary
 *  colorsBorderBorderSecondary    → border-secondary
 *  colorsForegroundFgWhite        → fg-white
 *  colorsEffectsShadowsShadowXs   → effect-shadow-xs
 *  componentColorsUtilityBrandUtilityBrand600  → utility-brand-600
 *  componentColorsAlphaAlphaWhite90            → alpha-white-90
 *  componentColorsComponentsButtonsButtonPrimaryIcon → comp-buttons-primary-icon
 */
function cleanSemanticName(raw: string): string {
  let s = raw;

  // ── Strip top-level prefixes ───────────────────────────────────
  // "componentColorsComponents..." → components...
  if (s.startsWith('componentColorsComponents')) {
    s = s.replace('componentColorsComponents', 'comp-');
  }
  // "componentColorsUtility..." → utility...
  else if (s.startsWith('componentColorsUtility')) {
    s = s.replace('componentColorsUtility', 'utility-');
  }
  // "componentColorsAlpha..." → alpha...
  else if (s.startsWith('componentColorsAlpha')) {
    s = s.replace('componentColorsAlpha', 'alpha-');
  }
  // "colorsEffects..." → effect-...
  else if (s.startsWith('colorsEffects')) {
    s = s.replace('colorsEffects', 'effect-');
  }
  // "colorsText..." → text-...
  else if (s.startsWith('colorsText')) {
    s = s.replace('colorsText', 'text-');
  }
  // "colorsBackground..." → bg-...
  else if (s.startsWith('colorsBackground')) {
    s = s.replace('colorsBackground', 'bg-');
  }
  // "colorsForeground..." → fg-...
  else if (s.startsWith('colorsForeground')) {
    s = s.replace('colorsForeground', 'fg-');
  }
  // "colorsBorder..." → border-...
  else if (s.startsWith('colorsBorder')) {
    s = s.replace('colorsBorder', 'border-');
  }

  // Convert remaining camelCase to kebab-case
  s = camelToKebab(s);

  // ── Remove known redundant segments ────────────────────────────
  // "text-text-primary" → "text-primary"
  s = s.replace(/^text-text-/, 'text-');
  // "bg-bg-" → "bg-"
  s = s.replace(/^bg-bg-/, 'bg-');
  // "border-border-" → "border-"
  s = s.replace(/^border-border-/, 'border-');
  // "fg-fg-" → "fg-"
  s = s.replace(/^fg-fg-/, 'fg-');
  // "effect-shadows-shadow-" → "effect-shadow-"
  s = s.replace(/^effect-shadows-shadow-/, 'effect-shadow-');
  // "effect-focus-rings-focus-ring" → "effect-focus-ring"
  s = s.replace(/^effect-focus-rings-focus-ring/, 'effect-focus-ring');
  // "effect-portfolio-mockups-shadow-" → "effect-mockup-shadow-"
  s = s.replace(/^effect-portfolio-mockups-shadow-/, 'effect-mockup-shadow-');
  // Utility redundancy: "utility-brand-utility-brand-600" → "utility-brand-600"
  s = s.replace(/utility-([a-z-]+?)-utility-\1-?/g, 'utility-$1-');
  // Remove trailing hyphens for utility names like "utility-gray-blue-a-k-a-neutral" simplify AKA
  s = s.replace(/-a-k-a-/g, '-');
  // Component names: remove double segments
  s = s.replace(/comp-([a-z-]+?)-\1-?/g, 'comp-$1-');
  // Alpha redundancy: "alpha-alpha-white" → "alpha-white"
  s = s.replace(/^alpha-alpha-/, 'alpha-');
  // Clean double/triple hyphens
  s = s.replace(/-{2,}/g, '-');
  // Remove leading/trailing hyphens
  s = s.replace(/^-|-$/g, '');

  return s;
}

/**
 * Clean primitive token name.
 * Examples:
 *  colorsBaseWhite   → base-white
 *  colorsGray500     → gray-500
 *  colorsBrand700    → brand-700
 */
function cleanPrimitiveName(raw: string): string {
  let s = raw;
  // Remove top "colors" prefix
  if (s.startsWith('colors')) {
    s = s.slice(6); // remove "colors"
  }
  // Handle AKA
  s = s.replace(/AKA/g, '');
  s = camelToKebab(s);
  s = s.replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
  return s;
}

// ── Token grouping ───────────────────────────────────────────────────────────

interface GroupedTokens {
  text: [string, string][];
  bg: [string, string][];
  border: [string, string][];
  fg: [string, string][];
  effects: [string, string][];
  utility: [string, string][];
  alpha: [string, string][];
  component: [string, string][];
}

function groupTokens(tokens: [string, string][]): GroupedTokens {
  const groups: GroupedTokens = {
    text: [],
    bg: [],
    border: [],
    fg: [],
    effects: [],
    utility: [],
    alpha: [],
    component: [],
  };

  for (const [name, value] of tokens) {
    if (name.startsWith('text-')) groups.text.push([name, value]);
    else if (name.startsWith('bg-')) groups.bg.push([name, value]);
    else if (name.startsWith('border-')) groups.border.push([name, value]);
    else if (name.startsWith('fg-')) groups.fg.push([name, value]);
    else if (name.startsWith('effect-')) groups.effects.push([name, value]);
    else if (name.startsWith('utility-')) groups.utility.push([name, value]);
    else if (name.startsWith('alpha-')) groups.alpha.push([name, value]);
    else if (name.startsWith('comp-')) groups.component.push([name, value]);
    else groups.component.push([name, value]); // fallback
  }

  // Sort each group
  for (const key of Object.keys(groups) as (keyof GroupedTokens)[]) {
    groups[key].sort(([a], [b]) => a.localeCompare(b));
  }

  return groups;
}

// ── CSS generation ───────────────────────────────────────────────────────────

function generateCSS(
  primitives: Record<string, string>,
  lightMode: Record<string, string>,
  darkMode: Record<string, string>,
  numericTokens?: {
    spacing?: Record<string, number>;
    radius?: Record<string, number>;
    typography?: Record<string, number>;
    widths?: Record<string, number>;
    containers?: Record<string, number>;
  },
): string {
  const lines: string[] = [];
  lines.push('/* ==========================================================================');
  lines.push('   BIA Design System — Design Tokens');
  lines.push('   Generated from tokens.json');
  lines.push('   ========================================================================== */');
  lines.push('');

  // ── Primitives (colors) ──
  const primEntries = Object.entries(primitives)
    .filter(([k, v]) => typeof v === 'string' && v.startsWith('#')) // Only colors
    .map(([k, v]) => [cleanPrimitiveName(k), v] as [string, string])
    .sort(([a], [b]) => a.localeCompare(b));
  
  if (primEntries.length > 0) {
    lines.push('/* ---------- Primitive palette (colors) ---------- */');
    lines.push(':root {');
    for (const [name, value] of primEntries) {
      lines.push(`  --primitive-${name}: ${value};`);
    }
    lines.push('}');
    lines.push('');
  }

  // ── Numeric tokens ──
  if (numericTokens) {
    lines.push('/* ---------- Numeric tokens (spacing, radius, typography, etc.) ---------- */');
    lines.push(':root {');

    // Spacing
    if (numericTokens.spacing) {
      lines.push('');
      lines.push('  /* Spacing */');
      const spacingEntries = Object.entries(numericTokens.spacing)
        .map(([k, v]) => [camelToKebab(k.replace(/^spacing/, '')), v] as [string, number])
        .sort(([a], [b]) => {
          // Sort by numeric value
          const numA = a.match(/\d+/) ? parseInt(a.match(/\d+/)![0]) : 0;
          const numB = b.match(/\d+/) ? parseInt(b.match(/\d+/)![0]) : 0;
          return numA - numB;
        });
      for (const [name, value] of spacingEntries) {
        lines.push(`  --spacing-${name}: ${value}px;`);
      }
    }

    // Border radius
    if (numericTokens.radius) {
      lines.push('');
      lines.push('  /* Border radius */');
      const radiusEntries = Object.entries(numericTokens.radius)
        .map(([k, v]) => [camelToKebab(k.replace(/^radius/, '')), v] as [string, number])
        .sort(([a], [b]) => {
          const numA = a.match(/\d+/) ? parseInt(a.match(/\d+/)![0]) : (a === 'full' ? 9999 : 0);
          const numB = b.match(/\d+/) ? parseInt(b.match(/\d+/)![0]) : (b === 'full' ? 9999 : 0);
          return numA - numB;
        });
      for (const [name, value] of radiusEntries) {
        lines.push(`  --radius-${name}: ${value === 9999 ? '9999px' : `${value}px`};`);
      }
    }

    // Typography
    if (numericTokens.typography) {
      lines.push('');
      lines.push('  /* Typography — Font sizes */');
      const fontSizeEntries = Object.entries(numericTokens.typography)
        .filter(([k]) => k.startsWith('fontSize'))
        .map(([k, v]) => [camelToKebab(k.replace(/^fontSize/, '')), v] as [string, number])
        .sort(([a], [b]) => {
          const numA = a.match(/\d+/) ? parseInt(a.match(/\d+/)![0]) : 0;
          const numB = b.match(/\d+/) ? parseInt(b.match(/\d+/)![0]) : 0;
          return numA - numB;
        });
      for (const [name, value] of fontSizeEntries) {
        lines.push(`  --font-size-${name}: ${value}px;`);
      }

      lines.push('');
      lines.push('  /* Typography — Line heights */');
      const lineHeightEntries = Object.entries(numericTokens.typography)
        .filter(([k]) => k.startsWith('lineHeight'))
        .map(([k, v]) => [camelToKebab(k.replace(/^lineHeight/, '')), v] as [string, number])
        .sort(([a], [b]) => {
          const numA = a.match(/\d+/) ? parseInt(a.match(/\d+/)![0]) : 0;
          const numB = b.match(/\d+/) ? parseInt(b.match(/\d+/)![0]) : 0;
          return numA - numB;
        });
      for (const [name, value] of lineHeightEntries) {
        lines.push(`  --line-height-${name}: ${value}px;`);
      }
    }

    // Widths
    if (numericTokens.widths) {
      lines.push('');
      lines.push('  /* Widths / Breakpoints */');
      const widthEntries = Object.entries(numericTokens.widths)
        .map(([k, v]) => [camelToKebab(k.replace(/^width/, '')), v] as [string, number])
        .sort(([a], [b]) => {
          const numA = a.match(/\d+/) ? parseInt(a.match(/\d+/)![0]) : 0;
          const numB = b.match(/\d+/) ? parseInt(b.match(/\d+/)![0]) : 0;
          return numA - numB;
        });
      for (const [name, value] of widthEntries) {
        lines.push(`  --width-${name}: ${value}px;`);
      }
    }

    // Containers
    if (numericTokens.containers) {
      lines.push('');
      lines.push('  /* Containers */');
      const containerEntries = Object.entries(numericTokens.containers)
        .map(([k, v]) => [camelToKebab(k), v] as [string, number]);
      for (const [name, value] of containerEntries) {
        lines.push(`  --container-${name}: ${value}px;`);
      }
    }

    lines.push('}');
    lines.push('');
  }

  // ── Light mode (default) ──
  const lightTokens = Object.entries(lightMode)
    .map(([k, v]) => [cleanSemanticName(k), v] as [string, string]);
  const lightGroups = groupTokens(lightTokens);

  lines.push('/* ---------- Semantic tokens — Light mode (default) ---------- */');
  lines.push(':root,');
  lines.push('[data-theme="light"] {');

  const sectionOrder: { key: keyof GroupedTokens; label: string }[] = [
    { key: 'text', label: 'Text' },
    { key: 'bg', label: 'Backgrounds' },
    { key: 'border', label: 'Borders' },
    { key: 'fg', label: 'Foregrounds' },
    { key: 'effects', label: 'Effects (shadows, focus rings)' },
    { key: 'utility', label: 'Utility colors' },
    { key: 'alpha', label: 'Alpha / transparency' },
    { key: 'component', label: 'Component-specific' },
  ];

  for (const { key, label } of sectionOrder) {
    const entries = lightGroups[key];
    if (entries.length === 0) continue;
    lines.push('');
    lines.push(`  /* ${label} */`);
    for (const [name, value] of entries) {
      lines.push(`  --${name}: ${value};`);
    }
  }

  lines.push('}');
  lines.push('');

  // ── Dark mode ──
  const darkTokens = Object.entries(darkMode)
    .map(([k, v]) => [cleanSemanticName(k), v] as [string, string]);
  const darkGroups = groupTokens(darkTokens);

  lines.push('/* ---------- Semantic tokens — Dark mode ---------- */');
  lines.push('[data-theme="dark"] {');

  for (const { key, label } of sectionOrder) {
    const entries = darkGroups[key];
    if (entries.length === 0) continue;
    lines.push('');
    lines.push(`  /* ${label} */`);
    for (const [name, value] of entries) {
      lines.push(`  --${name}: ${value};`);
    }
  }

  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

// ── Tailwind config generation ───────────────────────────────────────────────

function generateTailwindConfig(
  lightMode: Record<string, string>,
  numericTokens?: {
    spacing?: Record<string, number>;
    radius?: Record<string, number>;
    typography?: Record<string, number>;
    widths?: Record<string, number>;
    containers?: Record<string, number>;
  },
): string {
  const tokens = Object.entries(lightMode)
    .map(([k, v]) => [cleanSemanticName(k), v] as [string, string]);

  // Build nested object helpers
  const textColors: Map<string, string> = new Map();
  const bgColors: Map<string, string> = new Map();
  const borderColors: Map<string, string> = new Map();
  const fgColors: Map<string, string> = new Map();
  const effectColors: Map<string, string> = new Map();
  const utilityColors: Map<string, string> = new Map();
  const alphaColors: Map<string, string> = new Map();
  const compColors: Map<string, string> = new Map();

  for (const [name] of tokens) {
    if (name.startsWith('text-')) textColors.set(name.slice(5), `var(--${name})`);
    else if (name.startsWith('bg-')) bgColors.set(name.slice(3), `var(--${name})`);
    else if (name.startsWith('border-')) borderColors.set(name.slice(7), `var(--${name})`);
    else if (name.startsWith('fg-')) fgColors.set(name.slice(3), `var(--${name})`);
    else if (name.startsWith('effect-')) effectColors.set(name, `var(--${name})`);
    else if (name.startsWith('utility-')) utilityColors.set(name.slice(8), `var(--${name})`);
    else if (name.startsWith('alpha-')) alphaColors.set(name.slice(6), `var(--${name})`);
    else compColors.set(name, `var(--${name})`);
  }

  // Build numeric token maps
  const spacingMap: Map<string, string> = new Map();
  const radiusMap: Map<string, string> = new Map();
  const fontSizeMap: Map<string, string> = new Map();
  const lineHeightMap: Map<string, string> = new Map();
  const widthMap: Map<string, string> = new Map();

  if (numericTokens) {
    if (numericTokens.spacing) {
      Object.entries(numericTokens.spacing).forEach(([k, v]) => {
        const name = camelToKebab(k.replace(/^spacing/, ''));
        spacingMap.set(name, `var(--spacing-${name})`);
      });
    }
    if (numericTokens.radius) {
      Object.entries(numericTokens.radius).forEach(([k, v]) => {
        const name = camelToKebab(k.replace(/^radius/, ''));
        radiusMap.set(name, `var(--radius-${name})`);
      });
    }
    if (numericTokens.typography) {
      Object.entries(numericTokens.typography).forEach(([k, v]) => {
        if (k.startsWith('fontSize')) {
          const name = camelToKebab(k.replace(/^fontSize/, ''));
          fontSizeMap.set(name, `var(--font-size-${name})`);
        } else if (k.startsWith('lineHeight')) {
          const name = camelToKebab(k.replace(/^lineHeight/, ''));
          lineHeightMap.set(name, `var(--line-height-${name})`);
        }
      });
    }
    if (numericTokens.widths) {
      Object.entries(numericTokens.widths).forEach(([k, v]) => {
        const name = camelToKebab(k.replace(/^width/, ''));
        widthMap.set(name, `var(--width-${name})`);
      });
    }
  }

  function mapToObject(map: Map<string, string>, indent: number): string {
    const pad = ' '.repeat(indent);
    const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    return sorted.map(([k, v]) => `${pad}'${k}': '${v}',`).join('\n');
  }

  function mapToObjectNumeric(map: Map<string, string>, indent: number): string {
    const pad = ' '.repeat(indent);
    const sorted = Array.from(map.entries()).sort(([a], [b]) => {
      // Sort numerically if possible
      const numA = a.match(/\d+/) ? parseInt(a.match(/\d+/)![0]) : (a === 'full' ? 9999 : 0);
      const numB = b.match(/\d+/) ? parseInt(b.match(/\d+/)![0]) : (b === 'full' ? 9999 : 0);
      return numA - numB;
    });
    return sorted.map(([k, v]) => `${pad}'${k}': '${v}',`).join('\n');
  }

  return `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./packages/*/src/**/*.{js,ts,jsx,tsx}",
    "./packages/*/app/**/*.{js,ts,jsx,tsx}",
    "./packages/*/src/**/*.{html,md}",
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        /* Semantic text colors — use with text-{name} */
        text: {
${mapToObject(textColors, 10)}
        },
        /* Semantic background colors — use with bg-{name} */
        surface: {
${mapToObject(bgColors, 10)}
        },
        /* Semantic border colors — use with border-{name} */
        border: {
${mapToObject(borderColors, 10)}
        },
        /* Semantic foreground colors */
        fg: {
${mapToObject(fgColors, 10)}
        },
        /* Utility palette */
        utility: {
${mapToObject(utilityColors, 10)}
        },
        /* Alpha / transparency */
        alpha: {
${mapToObject(alphaColors, 10)}
        },
      },
      textColor: {
        /* Direct semantic text tokens: text-primary, text-secondary, etc. */
${mapToObject(textColors, 8)}
      },
      backgroundColor: {
        /* Direct semantic bg tokens: bg-primary, bg-secondary, etc. */
${mapToObject(bgColors, 8)}
      },
      borderColor: {
        /* Direct semantic border tokens: border-primary, border-secondary, etc. */
${mapToObject(borderColors, 8)}
      },
${spacingMap.size > 0 ? `      spacing: {
        /* Spacing tokens — use with p-{name}, m-{name}, gap-{name}, etc. */
${mapToObjectNumeric(spacingMap, 8)}
      },` : ''}
${radiusMap.size > 0 ? `      borderRadius: {
        /* Border radius tokens — use with rounded-{name} */
${mapToObjectNumeric(radiusMap, 8)}
      },` : ''}
${fontSizeMap.size > 0 ? `      fontSize: {
        /* Font size tokens — use with text-{name} */
${mapToObjectNumeric(fontSizeMap, 8)}
      },` : ''}
${lineHeightMap.size > 0 ? `      lineHeight: {
        /* Line height tokens — use with leading-{name} */
${mapToObjectNumeric(lineHeightMap, 8)}
      },` : ''}
${widthMap.size > 0 ? `      maxWidth: {
        /* Width / breakpoint tokens — use with max-w-{name} */
${mapToObjectNumeric(widthMap, 8)}
      },` : ''}
    },
  },
  plugins: [],
}
`;
}

// ── TypeScript types ─────────────────────────────────────────────────────────

function generateTypes(
  primitives: Record<string, string>,
  lightMode: Record<string, string>,
): string {
  const primNames = Object.entries(primitives)
    .map(([k]) => cleanPrimitiveName(k))
    .sort();

  const semanticNames = Object.entries(lightMode)
    .map(([k]) => cleanSemanticName(k))
    .sort();

  const textNames = semanticNames.filter(n => n.startsWith('text-')).map(n => n.slice(5));
  const bgNames = semanticNames.filter(n => n.startsWith('bg-')).map(n => n.slice(3));
  const borderNames = semanticNames.filter(n => n.startsWith('border-')).map(n => n.slice(7));
  const fgNames = semanticNames.filter(n => n.startsWith('fg-')).map(n => n.slice(3));
  const effectNames = semanticNames.filter(n => n.startsWith('effect-'));
  const utilityNames = semanticNames.filter(n => n.startsWith('utility-')).map(n => n.slice(8));
  const alphaNames = semanticNames.filter(n => n.startsWith('alpha-')).map(n => n.slice(6));

  function toUnion(names: string[]): string {
    return names.map(n => `  | '${n}'`).join('\n');
  }

  return `/**
 * BIA Design System — Design Token Types
 * Generated from tokens.json
 */

/** Primitive color token names (used as --primitive-{name}) */
export type PrimitiveColorToken =
${toUnion(primNames)};

/** Semantic text color token names (used as --text-{name}) */
export type TextColorToken =
${toUnion(textNames)};

/** Semantic background token names (used as --bg-{name}) */
export type BgColorToken =
${toUnion(bgNames)};

/** Semantic border token names (used as --border-{name}) */
export type BorderColorToken =
${toUnion(borderNames)};

/** Semantic foreground token names (used as --fg-{name}) */
export type FgColorToken =
${toUnion(fgNames)};

/** Effect token names (shadows, focus rings) (used as --effect-{name}) */
export type EffectToken =
${toUnion(effectNames)};

/** Utility color token names (used as --utility-{name}) */
export type UtilityColorToken =
${toUnion(utilityNames)};

/** Alpha / transparency token names (used as --alpha-{name}) */
export type AlphaToken =
${toUnion(alphaNames)};

/** All semantic token names */
export type SemanticToken =
  | \`text-\${TextColorToken}\`
  | \`bg-\${BgColorToken}\`
  | \`border-\${BorderColorToken}\`
  | \`fg-\${FgColorToken}\`
  | EffectToken
  | \`utility-\${UtilityColorToken}\`
  | \`alpha-\${AlphaToken}\`;

/** Theme variants */
export type Theme = 'light' | 'dark';

export interface DesignTokens {
  primitives: Record<PrimitiveColorToken, string>;
  light: Record<SemanticToken, string>;
  dark: Record<SemanticToken, string>;
}
`;
}

// ── Theme toggle utility ─────────────────────────────────────────────────────

function generateThemeToggle(): string {
  return `/**
 * BIA Design System — Theme Toggle Utility
 * Manages light / dark mode switching via the data-theme attribute on <html>.
 */

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'bia-theme';
const ATTRIBUTE = 'data-theme';

/**
 * Get the current active theme.
 */
export function getTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return (document.documentElement.getAttribute(ATTRIBUTE) as Theme) || 'light';
}

/**
 * Set the theme to 'light' or 'dark'.
 * Persists the choice in localStorage.
 */
export function setTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute(ATTRIBUTE, theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage may be unavailable (SSR, privacy mode)
  }
}

/**
 * Toggle between light and dark themes.
 * Returns the newly active theme.
 */
export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'light' ? 'dark' : 'light';
  setTheme(next);
  return next;
}

/**
 * Initialise the theme on page load.
 * Priority: localStorage → system preference → 'light'.
 * Call this once, e.g. in your root layout.
 */
export function initTheme(): Theme {
  if (typeof window === 'undefined') return 'light';

  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    // ignore
  }

  if (saved === 'light' || saved === 'dark') {
    setTheme(saved);
    return saved;
  }

  // Fall back to OS preference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme: Theme = prefersDark ? 'dark' : 'light';
  setTheme(theme);
  return theme;
}
`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error('Uso: node generate-from-json.js <path-to-tokens.json>');
    process.exit(1);
  }

  const raw = fs.readFileSync(jsonPath, 'utf-8');
  // The file might be a JSON string wrapped in quotes — handle that
  let data: any;
  try {
    data = JSON.parse(raw);
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }
  } catch (e) {
    console.error('Error parsing JSON:', e);
    process.exit(1);
  }

  let primitives: Record<string, string> = {};
  let lightMode: Record<string, string> = {};
  let darkMode: Record<string, string> = {};

  // Extract color tokens from JSON
  const jsonPrimitives = data.primitives?.style ?? {};
  const jsonLightMode = data['1ColorModes']?.lightMode ?? {};
  const jsonDarkMode = data['1ColorModes']?.darkMode ?? {};

  // Filter colors from primitives (values starting with #)
  for (const [k, v] of Object.entries(jsonPrimitives)) {
    if (typeof v === 'string' && v.startsWith('#')) {
      primitives[k] = v;
    }
  }
  lightMode = jsonLightMode;
  darkMode = jsonDarkMode;

  // If no colors found in JSON, try to preserve from existing tokens.css
  const root = process.cwd();
  const stylesDir = path.join(root, 'packages/core/src/styles');
  const existingCssPath = path.join(stylesDir, 'tokens.css');
  if (Object.keys(primitives).length === 0 && Object.keys(lightMode).length === 0 && fs.existsSync(existingCssPath)) {
    console.log('⚠️  No color tokens found in JSON. Reading existing tokens.css to preserve colors...');
    const existingCss = fs.readFileSync(existingCssPath, 'utf-8');
    // Extract primitive colors
    const primMatches = existingCss.matchAll(/--primitive-([^:]+):\s*([^;]+);/g);
    for (const match of primMatches) {
      const name = match[1].trim();
      const value = match[2].trim();
      if (value.startsWith('#')) {
        primitives[name.replace(/-/g, '')] = value; // Reverse kebab to camelCase-ish
      }
    }
    // Extract light mode tokens
    const lightSection = existingCss.match(/:root,\s*\[data-theme="light"\]\s*\{([^}]+)\}/s);
    if (lightSection) {
      const lightMatches = lightSection[1].matchAll(/--([^:]+):\s*([^;]+);/g);
      for (const match of lightMatches) {
        const name = match[1].trim();
        const value = match[2].trim();
        if (value.startsWith('#')) {
          // Reverse cleanSemanticName - approximate
          lightMode[name.replace(/-/g, '')] = value;
        }
      }
    }
    // Extract dark mode tokens
    const darkSection = existingCss.match(/\[data-theme="dark"\]\s*\{([^}]+)\}/s);
    if (darkSection) {
      const darkMatches = darkSection[1].matchAll(/--([^:]+):\s*([^;]+);/g);
      for (const match of darkMatches) {
        const name = match[1].trim();
        const value = match[2].trim();
        if (value.startsWith('#')) {
          darkMode[name.replace(/-/g, '')] = value;
        }
      }
    }
    console.log(`   Preserved: ${Object.keys(primitives).length} primitives, ${Object.keys(lightMode).length} light, ${Object.keys(darkMode).length} dark`);
  }

  // Extract numeric tokens
  const numericTokens = {
    spacing: {
      ...(data.primitives?.style ? Object.fromEntries(
        Object.entries(data.primitives.style).filter(([k, v]) => 
          k.startsWith('spacing') && typeof v === 'number'
        )
      ) : {}),
      ...(data['3Spacing']?.mode1 ?? {}),
    },
    radius: data['2Radius']?.mode1 ?? {},
    typography: data['6Typography']?.value ?? {},
    widths: data['4Widths']?.mode1 ?? {},
    containers: data['5Containers']?.value ?? {},
  };

  console.log(`📦 Tokens encontrados:`);
  console.log(`   Primitives (colors):  ${Object.keys(primitives).filter(k => typeof primitives[k] === 'string' && primitives[k].startsWith('#')).length}`);
  console.log(`   Light mode:  ${Object.keys(lightMode).length}`);
  console.log(`   Dark mode:   ${Object.keys(darkMode).length}`);
  console.log(`   Spacing:     ${Object.keys(numericTokens.spacing).length}`);
  console.log(`   Radius:      ${Object.keys(numericTokens.radius).length}`);
  console.log(`   Typography:  ${Object.keys(numericTokens.typography).length}`);
  console.log(`   Widths:      ${Object.keys(numericTokens.widths).length}`);
  console.log(`   Containers:  ${Object.keys(numericTokens.containers).length}`);
  console.log('');

  const typesDir = path.join(root, 'packages/core/src/types');
  const libDir = path.join(root, 'packages/core/src/lib');

  for (const dir of [stylesDir, typesDir, libDir]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  // 1. CSS
  let css = generateCSS(primitives, lightMode, darkMode, numericTokens);
  
  // If no colors were generated but we have existing CSS, merge them
  if (Object.keys(primitives).length === 0 && Object.keys(lightMode).length === 0 && fs.existsSync(existingCssPath)) {
    const existingCss = fs.readFileSync(existingCssPath, 'utf-8');
    // Extract color sections (everything before numeric tokens section)
    const numericSectionStart = existingCss.indexOf('/* ---------- Numeric tokens');
    if (numericSectionStart > 0) {
      const colorSections = existingCss.substring(0, numericSectionStart);
      // Combine: color sections + new numeric tokens
      const newNumericStart = css.indexOf('/* ---------- Numeric tokens');
      if (newNumericStart > 0) {
        const newNumericSection = css.substring(newNumericStart);
        css = colorSections + '\n' + newNumericSection;
        console.log('   ✅ Merged existing colors with new numeric tokens');
      }
    }
  }
  
  fs.writeFileSync(path.join(stylesDir, 'tokens.css'), css);
  console.log('✅ packages/core/src/styles/tokens.css');

  // 2. Tailwind config
  const tw = generateTailwindConfig(lightMode, numericTokens);
  fs.writeFileSync(path.join(root, 'tailwind.config.js'), tw);
  console.log('✅ tailwind.config.js');

  // 3. TypeScript types
  const ts = generateTypes(primitives, lightMode);
  fs.writeFileSync(path.join(typesDir, 'tokens.ts'), ts);
  console.log('✅ packages/core/src/types/tokens.ts');

  // 4. Theme toggle
  const toggle = generateThemeToggle();
  fs.writeFileSync(path.join(libDir, 'theme-toggle.ts'), toggle);
  console.log('✅ packages/core/src/lib/theme-toggle.ts');

  console.log('\n🎉 ¡Todos los archivos generados exitosamente!');
}

main();
