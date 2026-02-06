'use client';

import { useEffect, useState, useRef } from 'react';
import { getTheme, setTheme, toggleTheme } from '../../../core/src/lib/theme-toggle';

// Importar estilos del inspector
import './inspector.css';

interface Token {
  name: string;
  value: string;
}

interface TokenData {
  primitives: Token[];
  light: Token[];
  dark: Token[];
  typography: {
    fontSize: Token[];
    lineHeight: Token[];
  };
}

export default function InspectorPage() {
  const [tokens, setTokens] = useState<TokenData | null>(null);
  const [activeTab, setActiveTab] = useState('primitives');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light');
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Inicializar tema
    const theme = getTheme();
    setCurrentTheme(theme);
    document.documentElement.setAttribute('data-theme', theme);

    // Parsear tokens después de que los estilos se hayan cargado
    const parseTokens = () => {
      const allTokens = parseTokensFromCSS();
      setTokens(allTokens);
      renderContent(allTokens);
    };

    // Esperar a que los estilos se carguen
    if (document.readyState === 'complete') {
      setTimeout(parseTokens, 100);
    } else {
      window.addEventListener('load', () => setTimeout(parseTokens, 100));
    }
  }, []);

  useEffect(() => {
    if (tokens && mainRef.current) {
      renderContent(tokens);
    }
  }, [activeTab, tokens, currentTheme]);

  const handleThemeToggle = () => {
    const newTheme = toggleTheme();
    setCurrentTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    // Re-renderizar para actualizar valores resueltos después de que el tema se aplique
    if (tokens) {
      setTimeout(() => {
        if (mainRef.current) {
          renderContent(tokens);
        }
      }, 100);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    const query = e.target.value.toLowerCase();
    document.querySelectorAll('[data-name]').forEach((el) => {
      const name = (el.getAttribute('data-name') || '').toLowerCase();
      const value = (el.getAttribute('data-value') || '').toLowerCase();
      (el as HTMLElement).style.display = !query || name.includes(query) || value.includes(query) ? '' : 'none';
    });
  };

  const renderContent = (allTokens: TokenData, tab: string = activeTab) => {
    if (!mainRef.current) return;

    const cats = categorizeSemanticTokens(allTokens.light);
    const primGroups = groupByFamily(allTokens.primitives);
    const issues = detectIssues(allTokens);

    let html = '';

    // Primitives
    if (tab === 'primitives') {
      html = '<div class="section visible"><h2>Primitive Palette</h2><p class="subtitle">Base color palette grouped by family</p>';
      for (const [family, tokens] of Object.entries(primGroups).sort(([a], [b]) => a.localeCompare(b))) {
        html += `<h3>${family}</h3><div class="swatch-grid">${renderSwatchGrid(tokens)}</div>`;
      }
      html += '</div>';
    }

    // Text
    if (tab === 'text') {
      html = `<div class="section visible"><h2>Text Colors</h2><p class="subtitle">${cats.text.length} tokens</p>${renderTextTokens(cats.text)}</div>`;
    }

    // Backgrounds
    if (tab === 'backgrounds') {
      html = `<div class="section visible"><h2>Background Colors</h2><p class="subtitle">${cats.bg.length} tokens</p><div class="swatch-grid">${renderSwatchGrid(cats.bg)}</div></div>`;
    }

    // Borders
    if (tab === 'borders') {
      html = `<div class="section visible"><h2>Border Colors</h2><p class="subtitle">${cats.border.length} tokens</p>${renderBorderTokens(cats.border)}</div>`;
    }

    // Foregrounds
    if (tab === 'foregrounds') {
      html = `<div class="section visible"><h2>Foreground Colors</h2><p class="subtitle">${cats.fg.length} tokens</p>${renderFgTokens(cats.fg)}</div>`;
    }

    // Effects
    if (tab === 'effects') {
      html = `<div class="section visible"><h2>Effects — Shadows & Focus Rings</h2><p class="subtitle">${cats.effect.length} tokens</p>${renderEffectTokens(cats.effect)}</div>`;
    }

    // Utility
    if (tab === 'utility') {
      const utilGroups = groupByFamily(cats.utility.map(t => ({ ...t, name: t.name.replace('--utility-', '--primitive-') })));
      html = `<div class="section visible"><h2>Utility Colors</h2><p class="subtitle">${cats.utility.length} tokens</p>`;
      for (const [family, tokens] of Object.entries(utilGroups).sort(([a], [b]) => a.localeCompare(b))) {
        const fixed = tokens.map(t => ({ ...t, name: t.name.replace('--primitive-', '--utility-') }));
        html += `<h3>${family}</h3><div class="swatch-grid">${renderSwatchGrid(fixed)}</div>`;
      }
      html += '</div>';
    }

    // Alpha
    if (tab === 'alpha') {
      html = `<div class="section visible"><h2>Alpha / Transparency</h2><p class="subtitle">${cats.alpha.length} tokens</p>${renderAlphaTokens(cats.alpha)}</div>`;
    }

    // Components
    if (tab === 'components') {
      html = `<div class="section visible"><h2>Component-Specific Tokens</h2><p class="subtitle">${cats.comp.length} tokens</p><div class="swatch-grid">${renderSwatchGrid(cats.comp)}</div></div>`;
    }

    // Typography
    if (tab === 'typography') {
      const typoData = allTokens.typography || { fontSize: [], lineHeight: [] };
      html = `<div class="section visible"><h2>Typography Variables</h2><p class="subtitle">Font sizes and line heights</p>${renderTypographyTokens(typoData)}</div>`;
    }

    // Previews
    if (tab === 'previews') {
      html = `<div class="section visible"><h2>Component Previews</h2><p class="subtitle">Real UI patterns using only design tokens</p>${renderUIPreviews()}</div>`;
    }

    // Issues
    if (tab === 'issues') {
      html = `<div class="section visible"><h2>Issue Report</h2><p class="subtitle">${issues.length} issues detected</p>
        ${issues.length === 0 ? '<p style="color:var(--text-success-primary);font-weight:600">No issues detected.</p>' : ''}
        <table class="table-demo" style="margin-top:12px"><thead><tr><th>Type</th><th>Details</th></tr></thead><tbody>
        ${issues.map(i => `<tr><td><span class="badge-demo" style="background:var(--utility-${i.type==='broken'||i.type==='contrast'?'error':'warning'}-100);color:var(--utility-${i.type==='broken'||i.type==='contrast'?'error':'warning'}-700);font-size:11px">${i.type}</span></td><td style="font-size:12px;font-family:monospace">${i.msg}</td></tr>`).join('')}
        </tbody></table>
        <button class="export-btn" style="margin-top:12px;border-color:var(--border-primary);color:var(--text-primary)" onclick="exportIssues()">Export issues as JSON</button>
      </div>`;
    }

    if (mainRef.current) {
      mainRef.current.innerHTML = html;
    }

    // Attach copy handlers
    mainRef.current.querySelectorAll('.swatch-copy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const text = (e.target as HTMLElement).getAttribute('data-copy') || '';
        copyToClipboard(text);
      });
    });
  };

  if (!tokens) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <p>Cargando tokens...</p>
      </div>
    );
  }

  const cats = categorizeSemanticTokens(tokens.light);
  const issues = detectIssues(tokens);

  return (
    <>
      <div className="header">
        <h1>Token Inspector</h1>
        <input
          className="search"
          type="text"
          placeholder="Search tokens by name or value…"
          value={searchQuery}
          onChange={handleSearch}
        />
        <button className="toggle-btn" onClick={handleThemeToggle}>
          {currentTheme === 'light' ? 'Dark mode' : 'Light mode'}
        </button>
      </div>

      <div className="tabs">
        {[
          { id: 'primitives', label: 'Primitives' },
          { id: 'text', label: 'Text' },
          { id: 'typography', label: 'Typography' },
          { id: 'backgrounds', label: 'Backgrounds' },
          { id: 'borders', label: 'Borders' },
          { id: 'foregrounds', label: 'Foregrounds' },
          { id: 'effects', label: 'Effects' },
          { id: 'utility', label: 'Utility' },
          { id: 'alpha', label: 'Alpha' },
          { id: 'components', label: 'Components' },
          { id: 'previews', label: 'UI Previews' },
          { id: 'issues', label: 'Issues' },
        ].map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="stats">
        <span>Primitives: <b>{tokens.primitives.length}</b></span>
        <span>Light: <b>{tokens.light.length}</b></span>
        <span>Dark: <b>{tokens.dark.length}</b></span>
        <span>Text: <b>{cats.text.length}</b></span>
        <span>Typography: <b>{tokens.typography.fontSize.length + tokens.typography.lineHeight.length}</b></span>
        <span>BG: <b>{cats.bg.length}</b></span>
        <span>Border: <b>{cats.border.length}</b></span>
        <span>FG: <b>{cats.fg.length}</b></span>
        <span>Effects: <b>{cats.effect.length}</b></span>
        <span>Utility: <b>{cats.utility.length}</b></span>
        <span>Alpha: <b>{cats.alpha.length}</b></span>
        <span>Components: <b>{cats.comp.length}</b></span>
        <span>Issues: <b style={{ color: issues.length ? 'var(--text-error-primary)' : 'var(--text-success-primary)' }}>{issues.length}</b></span>
      </div>

      {issues.length > 0 && (
        <div className="warnings visible">
          <h3>Broken Token Detector</h3>
          <ul id="issueList">
            {issues.map((issue, i) => (
              <li key={i}>
                <span className={`badge ${issue.type === 'broken' || issue.type === 'contrast' ? 'badge-red' : issue.type === 'unchanged' ? 'badge-yellow' : 'badge-gray'}`}>
                  {issue.type}
                </span>
                {issue.msg}
              </li>
            ))}
          </ul>
          <button className="export-btn" onClick={() => exportIssues(issues)}>Export issues as JSON</button>
        </div>
      )}

      <div className="main" ref={mainRef} />
    </>
  );
}

// Helper functions (same as HTML version)
function parseTokensFromCSS(): TokenData {
  const tokens: TokenData = { 
    primitives: [], 
    light: [], 
    dark: [],
    typography: {
      fontSize: [],
      lineHeight: []
    }
  };
  
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules || sheet.rules;
    } catch {
      continue;
    }
    if (!rules) continue;

    for (const rule of rules) {
      if (!(rule instanceof CSSStyleRule)) continue;
      const sel = (rule.selectorText || '').replace(/\s+/g, ' ').trim();
      const style = rule.style;

      for (let i = 0; i < style.length; i++) {
        const prop = style[i];
        if (!prop.startsWith('--')) continue;
        const val = style.getPropertyValue(prop).trim();

        const isDark = sel.includes('[data-theme="dark"]');
        const isLightOrRoot = sel.includes(':root');
        const isLightExplicit = sel.includes('[data-theme="light"]');
        const isPrimitive = prop.startsWith('--primitive');

        // Typography tokens
        if (prop.startsWith('--font-size-')) {
          tokens.typography.fontSize.push({ name: prop, value: val });
        } else if (prop.startsWith('--line-height-')) {
          tokens.typography.lineHeight.push({ name: prop, value: val });
        } else if (isDark && !isLightExplicit) {
          tokens.dark.push({ name: prop, value: val });
        } else if (isPrimitive) {
          tokens.primitives.push({ name: prop, value: val });
        } else if (isLightOrRoot || isLightExplicit) {
          tokens.light.push({ name: prop, value: val });
        }
      }
    }
  }

  const dedup = (arr: Token[]) => {
    const seen = new Set();
    return arr.filter(t => { if (seen.has(t.name)) return false; seen.add(t.name); return true; });
  };
  
  tokens.primitives = dedup(tokens.primitives);
  tokens.light = dedup(tokens.light);
  tokens.dark = dedup(tokens.dark);
  tokens.typography.fontSize = dedup(tokens.typography.fontSize);
  tokens.typography.lineHeight = dedup(tokens.typography.lineHeight);

  return tokens;
}

function getResolved(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function hexToRgb(hex: string): [number, number, number] {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length === 8) hex = hex.slice(0, 6);
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function contrastBadge(ratio: number): string {
  if (ratio >= 7) return '<span class="contrast-badge contrast-aaa">AAA ' + ratio.toFixed(1) + '</span>';
  if (ratio >= 4.5) return '<span class="contrast-badge contrast-aa">AA ' + ratio.toFixed(1) + '</span>';
  return '<span class="contrast-badge contrast-fail">FAIL ' + ratio.toFixed(1) + '</span>';
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    const toast = document.createElement('div');
    toast.textContent = 'Copied!';
    toast.style.cssText = 'position:fixed;bottom:24px;right:24px;padding:8px 16px;border-radius:8px;background:var(--bg-brand-solid);color:var(--text-primary-button);font-size:13px;font-weight:600;z-index:9999;animation:fadeout .8s .5s forwards';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1400);
  });
}

function groupByFamily(tokens: Token[]): Record<string, Token[]> {
  const groups: Record<string, Token[]> = {};
  tokens.forEach(t => {
    const parts = t.name.replace('--primitive-', '').replace('--', '').split('-');
    let family = parts[0];
    if (parts[1] && ['light', 'dark', 'blue', 'mode'].includes(parts[1])) family += '-' + parts[1];
    if (!groups[family]) groups[family] = [];
    groups[family].push(t);
  });
  return groups;
}

function categorizeSemanticTokens(tokens: Token[]): Record<string, Token[]> {
  const cats: Record<string, Token[]> = { text: [], bg: [], border: [], fg: [], effect: [], utility: [], alpha: [], comp: [] };
  tokens.forEach(t => {
    const n = t.name.replace('--', '');
    if (n.startsWith('text-')) cats.text.push(t);
    else if (n.startsWith('bg-')) cats.bg.push(t);
    else if (n.startsWith('border-')) cats.border.push(t);
    else if (n.startsWith('fg-')) cats.fg.push(t);
    else if (n.startsWith('effect-')) cats.effect.push(t);
    else if (n.startsWith('utility-')) cats.utility.push(t);
    else if (n.startsWith('alpha-')) cats.alpha.push(t);
    else if (n.startsWith('comp-')) cats.comp.push(t);
    else cats.comp.push(t);
  });
  return cats;
}

function detectIssues(allTokens: TokenData): Array<{ type: string; msg: string }> {
  const issues: Array<{ type: string; msg: string }> = [];
  const lightMap = new Map(allTokens.light.map(t => [t.name, t.value]));
  const darkMap = new Map(allTokens.dark.map(t => [t.name, t.value]));
  const bgLight = lightMap.get('--bg-primary') || '#fafafa';
  const bgDark = darkMap.get('--bg-primary') || '#0c0e12';

  allTokens.light.forEach(t => {
    const resolved = getResolved(t.name);
    if (!resolved || resolved === 'inherit' || resolved === 'undefined') {
      issues.push({ type: 'broken', msg: `${t.name} resolves to "${resolved || 'empty'}"` });
    }
  });

  allTokens.light.forEach(t => {
    const dv = darkMap.get(t.name);
    if (dv && dv === t.value) {
      issues.push({ type: 'unchanged', msg: `${t.name} same in both modes: ${t.value}` });
    }
  });

  allTokens.light.filter(t => t.name.startsWith('--text-') && !t.name.includes('on-brand') && !t.name.includes('button')).forEach(t => {
    try {
      const ratio = contrastRatio(t.value, bgLight);
      if (ratio < 4.5) {
        issues.push({ type: 'contrast', msg: `Light: ${t.name} (${t.value}) vs bg-primary — ratio ${ratio.toFixed(2)} < 4.5:1` });
      }
    } catch {}
  });

  allTokens.dark.filter(t => t.name.startsWith('--text-') && !t.name.includes('on-brand') && !t.name.includes('button')).forEach(t => {
    try {
      const ratio = contrastRatio(t.value, bgDark);
      if (ratio < 4.5) {
        issues.push({ type: 'contrast', msg: `Dark: ${t.name} (${t.value}) vs bg-primary — ratio ${ratio.toFixed(2)} < 4.5:1` });
      }
    } catch {}
  });

  const valToNames: Record<string, string[]> = {};
  allTokens.light.forEach(t => {
    if (!valToNames[t.value]) valToNames[t.value] = [];
    valToNames[t.value].push(t.name);
  });
  Object.entries(valToNames).forEach(([val, names]) => {
    if (names.length > 3) {
      issues.push({ type: 'duplicate', msg: `Value ${val} shared by ${names.length} tokens: ${names.slice(0, 4).join(', ')}${names.length > 4 ? '…' : ''}` });
    }
  });

  return issues;
}

function renderSwatchGrid(tokens: Token[]): string {
  return tokens.map(t => {
    const resolved = getResolved(t.name);
    return `<div class="swatch" data-name="${t.name}" data-value="${resolved}">
      <div class="swatch-preview" style="background:var(${t.name})">
        <button class="swatch-copy" data-copy="var(${t.name})">Copy</button>
      </div>
      <div class="swatch-info">
        <div class="swatch-name">${t.name}</div>
        <div class="swatch-value">${resolved || t.value}</div>
      </div>
    </div>`;
  }).join('');
}

function renderTextTokens(tokens: Token[]): string {
  const bgHex = getResolved('--bg-primary');
  return tokens.map(t => {
    const resolved = getResolved(t.name);
    let badge = '';
    try { badge = contrastBadge(contrastRatio(resolved, bgHex)); } catch {}
    return `<div class="text-row" data-name="${t.name}" data-value="${resolved}">
      <span class="text-sample" style="color:var(${t.name})">The quick brown fox — ${t.name.replace('--', '')}</span>
      <span class="text-meta">${resolved} ${badge}</span>
    </div>`;
  }).join('');
}

function renderBorderTokens(tokens: Token[]): string {
  return `<div class="swatch-grid">${tokens.map(t => {
    const resolved = getResolved(t.name);
    return `<div class="border-box" style="border:2px solid var(${t.name})" data-name="${t.name}" data-value="${resolved}">
      ${t.name.replace('--', '')}<br><span style="font-size:10px;opacity:.7">${resolved}</span>
    </div>`;
  }).join('')}</div>`;
}

function renderFgTokens(tokens: Token[]): string {
  return tokens.map(t => {
    const resolved = getResolved(t.name);
    return `<div class="fg-row" data-name="${t.name}" data-value="${resolved}">
      <div class="fg-circle" style="background:var(${t.name})"></div>
      <span class="fg-label">${t.name.replace('--', '')} <span style="opacity:.6">${resolved}</span></span>
    </div>`;
  }).join('');
}

function renderEffectTokens(tokens: Token[]): string {
  return `<div class="swatch-grid">${tokens.map(t => {
    const resolved = getResolved(t.name);
    const isFocus = t.name.includes('focus');
    const shadow = isFocus
      ? `box-shadow:0 0 0 4px var(${t.name})`
      : `box-shadow:0 4px 16px var(${t.name})`;
    return `<div class="shadow-card" style="${shadow}" data-name="${t.name}" data-value="${resolved}">
      ${t.name.replace('--effect-', '')}<br><span style="font-size:10px;opacity:.6">${resolved}</span>
    </div>`;
  }).join('')}</div>`;
}

function renderAlphaTokens(tokens: Token[]): string {
  return `<div class="swatch-grid">${tokens.map(t => {
    const resolved = getResolved(t.name);
    return `<div class="swatch" data-name="${t.name}" data-value="${resolved}">
      <div class="checker"><div class="alpha-overlay" style="background:var(${t.name})"></div></div>
      <div class="swatch-info">
        <div class="swatch-name">${t.name.replace('--', '')}</div>
        <div class="swatch-value">${resolved}</div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function renderTypographyTokens(typography: { fontSize: Token[]; lineHeight: Token[] }): string {
  // Crear un mapa de fontSize a lineHeight para emparejar
  const fontSizeMap = new Map(typography.fontSize.map(t => [t.name.replace('--font-size-', ''), t]));
  const lineHeightMap = new Map(typography.lineHeight.map(t => [t.name.replace('--line-height-', ''), t]));

  // Agrupar por tipo (text vs display)
  const textSizes = Array.from(fontSizeMap.entries()).filter(([name]) => name.startsWith('text-')).sort();
  const displaySizes = Array.from(fontSizeMap.entries()).filter(([name]) => name.startsWith('display-')).sort();

  let html = '';

  // Font Sizes - Text
  if (textSizes.length > 0) {
    html += '<h3>Text Sizes</h3>';
    html += '<div class="typography-grid">';
    for (const [name, fontSizeToken] of textSizes) {
      const fontSize = getResolved(fontSizeToken.name);
      const lineHeightToken = lineHeightMap.get(name);
      const lineHeight = lineHeightToken ? getResolved(lineHeightToken.name) : 'normal';
      
      html += `<div class="typography-sample" data-name="${fontSizeToken.name}" data-value="${fontSize}">
        <div class="typography-preview" style="font-size:var(${fontSizeToken.name});line-height:var(${lineHeightToken?.name || 'normal'});color:var(--text-primary)">
          The quick brown fox jumps over the lazy dog
        </div>
        <div class="typography-info">
          <div class="typography-name">
            <button class="swatch-copy" data-copy="var(${fontSizeToken.name})" style="position:static;opacity:1;margin-right:8px">Copy</button>
            ${fontSizeToken.name.replace('--font-size-', '')}
          </div>
          <div class="typography-meta">
            <span>Size: <code>${fontSize}</code></span>
            ${lineHeightToken ? `<span>Line-height: <code>${lineHeight}</code></span>` : ''}
          </div>
        </div>
      </div>`;
    }
    html += '</div>';
  }

  // Font Sizes - Display
  if (displaySizes.length > 0) {
    html += '<h3>Display Sizes</h3>';
    html += '<div class="typography-grid">';
    for (const [name, fontSizeToken] of displaySizes) {
      const fontSize = getResolved(fontSizeToken.name);
      const lineHeightToken = lineHeightMap.get(name);
      const lineHeight = lineHeightToken ? getResolved(lineHeightToken.name) : 'normal';
      
      html += `<div class="typography-sample typography-display" data-name="${fontSizeToken.name}" data-value="${fontSize}">
        <div class="typography-preview" style="font-size:var(${fontSizeToken.name});line-height:var(${lineHeightToken?.name || 'normal'});color:var(--text-primary);font-weight:700">
          Display Text
        </div>
        <div class="typography-info">
          <div class="typography-name">
            <button class="swatch-copy" data-copy="var(${fontSizeToken.name})" style="position:static;opacity:1;margin-right:8px">Copy</button>
            ${fontSizeToken.name.replace('--font-size-', '')}
          </div>
          <div class="typography-meta">
            <span>Size: <code>${fontSize}</code></span>
            ${lineHeightToken ? `<span>Line-height: <code>${lineHeight}</code></span>` : ''}
          </div>
        </div>
      </div>`;
    }
    html += '</div>';
  }

  // Line Heights (si hay algunos sin fontSize correspondiente)
  const orphanLineHeights = typography.lineHeight.filter(lh => {
    const name = lh.name.replace('--line-height-', '');
    return !fontSizeMap.has(name);
  });

  if (orphanLineHeights.length > 0) {
    html += '<h3>Line Heights (standalone)</h3>';
    html += '<div class="typography-grid">';
    for (const lhToken of orphanLineHeights) {
      const lineHeight = getResolved(lhToken.name);
      html += `<div class="typography-sample" data-name="${lhToken.name}" data-value="${lineHeight}">
        <div class="typography-preview" style="line-height:var(${lhToken.name});color:var(--text-primary)">
          Sample text with custom line height
        </div>
        <div class="typography-info">
          <div class="typography-name">
            <button class="swatch-copy" data-copy="var(${lhToken.name})" style="position:static;opacity:1;margin-right:8px">Copy</button>
            ${lhToken.name.replace('--line-height-', '')}
          </div>
          <div class="typography-meta">
            <span>Line-height: <code>${lineHeight}</code></span>
          </div>
        </div>
      </div>`;
    }
    html += '</div>';
  }

  return html;
}

function renderUIPreviews(): string {
  return `
  <h3>Buttons</h3>
  <div class="preview-row">
    <button class="btn" style="background:var(--bg-button-brand-primary);color:var(--text-primary-button)">Primary</button>
    <button class="btn" style="background:var(--bg-secondary);color:var(--text-secondary);border-color:var(--border-primary)">Secondary</button>
    <button class="btn" style="background:var(--bg-disabled);color:var(--text-disabled);cursor:not-allowed;border-color:var(--border-disabled)">Disabled</button>
    <button class="btn" style="background:var(--bg-error-solid);color:#fff">Destructive</button>
    <button class="btn" style="background:var(--bg-success-solid);color:#fff">Success</button>
  </div>
  <h3>Input Fields</h3>
  <div class="preview-row">
    <input class="input-demo" placeholder="Default input" style="border-color:var(--border-primary)" />
    <input class="input-demo" placeholder="Error state" style="border-color:var(--border-error);box-shadow:0 0 0 4px var(--effect-focus-ring-error)" />
    <input class="input-demo" placeholder="Disabled" disabled style="background:var(--bg-disabled);color:var(--text-disabled);border-color:var(--border-disabled)" />
  </div>
  <h3>Alerts & Banners</h3>
  <div class="preview-row">
    <div class="alert" style="background:var(--bg-error-primary);border:1px solid var(--border-error-subtle);color:var(--text-error-primary)">
      <span style="font-size:18px">✕</span> Error — Something went wrong.
    </div>
    <div class="alert" style="background:var(--utility-warning-50);border:1px solid var(--utility-warning-200);color:var(--text-warning-primary)">
      <span style="font-size:18px">⚠</span> Warning — Please review this.
    </div>
    <div class="alert" style="background:var(--bg-success-primary);border:1px solid var(--utility-success-200);color:var(--text-success-primary)">
      <span style="font-size:18px">✓</span> Success — Operation completed.
    </div>
  </div>
  <h3>Cards — Text Hierarchy</h3>
  <div class="preview-row">
    <div class="card-demo">
      <h4 style="color:var(--text-primary);font-size:16px;font-weight:700;margin-bottom:4px">Card title (text-primary)</h4>
      <p style="color:var(--text-secondary);font-size:14px;margin-bottom:4px">Subtitle (text-secondary)</p>
      <p style="color:var(--text-tertiary);font-size:13px;margin-bottom:4px">Context (text-tertiary)</p>
      <p style="color:var(--text-quaternary);font-size:12px">Metadata (text-quaternary)</p>
    </div>
  </div>
  `;
}

function exportIssues(issues: Array<{ type: string; msg: string }>) {
  const blob = new Blob([JSON.stringify(issues, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'token-issues.json';
  a.click();
}

// Make exportIssues available globally for onclick handlers
if (typeof window !== 'undefined') {
  (window as any).exportIssues = exportIssues;
}
