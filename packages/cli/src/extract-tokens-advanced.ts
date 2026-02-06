/**
 * Script avanzado para extraer tokens de diseño de Figma con sus valores reales
 * Usa múltiples endpoints de la API para obtener valores completos
 */

interface FigmaFile {
  document: {
    id: string;
    name: string;
    type: string;
    children: FigmaNode[];
  };
  styles: Record<string, FigmaStyle>;
}

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  fills?: FigmaFill[];
  effects?: FigmaEffect[];
  characters?: string;
  style?: TextStyle;
  cornerRadius?: number;
  width?: number;
  height?: number;
  children?: FigmaNode[];
  styles?: {
    fill?: string;
    text?: string;
    effect?: string;
  };
}

interface TextStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeightPx?: number;
  letterSpacing?: number;
}

interface FigmaFill {
  type: string;
  color?: { r: number; g: number; b: number; a: number };
  gradientStops?: Array<{ color: { r: number; g: number; b: number; a: number }; position: number }>;
}

interface FigmaEffect {
  type: string;
  visible?: boolean;
  radius?: number;
  color?: { r: number; g: number; b: number; a: number };
  offset?: { x: number; y: number };
  spread?: number;
}

interface FigmaStyle {
  key: string;
  name: string;
  styleType: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID';
  description: string;
}

interface DesignTokens {
  colors: Map<string, string>;
  typography: Map<string, TypographyToken>;
  spacing: Map<string, number>;
  borderRadius: Map<string, number>;
  shadows: Map<string, ShadowToken>;
}

interface TypographyToken {
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing?: number;
  fontFamily?: string;
}

interface ShadowToken {
  type: 'drop' | 'inner';
  offsetX: number;
  offsetY: number;
  blurRadius: number;
  spreadRadius: number;
  color: string;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(n * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbaToHex(r: number, g: number, b: number, a: number): string {
  if (a === 1) {
    return rgbToHex(r, g, b);
  }
  const toHex = (n: number) => {
    const hex = Math.round(n * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  const alphaHex = Math.round(a * 255).toString(16);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}${alphaHex.length === 1 ? '0' + alphaHex : alphaHex}`;
}

function extractColorFromFill(fill: FigmaFill): string | null {
  if (fill.type === 'SOLID' && fill.color) {
    return rgbaToHex(fill.color.r, fill.color.g, fill.color.b, fill.color.a);
  }
  if (fill.type === 'GRADIENT_LINEAR' && fill.gradientStops && fill.gradientStops.length > 0) {
    const firstStop = fill.gradientStops[0];
    return rgbaToHex(firstStop.color.r, firstStop.color.g, firstStop.color.b, firstStop.color.a);
  }
  return null;
}

function extractShadowFromEffect(effect: FigmaEffect): ShadowToken | null {
  if (effect.type === 'DROP_SHADOW' && effect.visible !== false && effect.color) {
    return {
      type: 'drop',
      offsetX: effect.offset?.x || 0,
      offsetY: effect.offset?.y || 0,
      blurRadius: effect.radius || 0,
      spreadRadius: effect.spread || 0,
      color: rgbaToHex(effect.color.r, effect.color.g, effect.color.b, effect.color.a),
    };
  }
  if (effect.type === 'INNER_SHADOW' && effect.visible !== false && effect.color) {
    return {
      type: 'inner',
      offsetX: effect.offset?.x || 0,
      offsetY: effect.offset?.y || 0,
      blurRadius: effect.radius || 0,
      spreadRadius: effect.spread || 0,
      color: rgbaToHex(effect.color.r, effect.color.g, effect.color.b, effect.color.a),
    };
  }
  return null;
}

function normalizeTokenName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\//g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function fetchFigmaFile(fileId: string, accessToken: string) {
  const url = `https://api.figma.com/v1/files/${fileId}`;
  const response = await fetch(url, {
    headers: { 'X-Figma-Token': accessToken },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json() as Promise<FigmaFile>;
}

async function fetchNodeData(fileId: string, nodeIds: string[], accessToken: string) {
  const ids = nodeIds.join(',');
  const url = `https://api.figma.com/v1/files/${fileId}/nodes?ids=${ids}`;
  const response = await fetch(url, {
    headers: { 'X-Figma-Token': accessToken },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

function extractTokensFromFile(figmaFile: FigmaFile): DesignTokens {
  const tokens: DesignTokens = {
    colors: new Map(),
    typography: new Map(),
    spacing: new Map(),
    borderRadius: new Map(),
    shadows: new Map(),
  };

  // Mapear estilos a sus IDs de nodo
  const styleToNodeMap = new Map<string, string[]>();
  
  function collectNodeIds(node: FigmaNode) {
    // Si el nodo tiene estilos aplicados
    if (node.styles) {
      if (node.styles.fill && figmaFile.styles[node.styles.fill]) {
        const styleName = figmaFile.styles[node.styles.fill].name;
        if (!styleToNodeMap.has(styleName)) {
          styleToNodeMap.set(styleName, []);
        }
        styleToNodeMap.get(styleName)!.push(node.id);
      }
      if (node.styles.text && figmaFile.styles[node.styles.text]) {
        const styleName = figmaFile.styles[node.styles.text].name;
        if (!styleToNodeMap.has(styleName)) {
          styleToNodeMap.set(styleName, []);
        }
        styleToNodeMap.get(styleName)!.push(node.id);
      }
      if (node.styles.effect && figmaFile.styles[node.styles.effect]) {
        const styleName = figmaFile.styles[node.styles.effect].name;
        if (!styleToNodeMap.has(styleName)) {
          styleToNodeMap.set(styleName, []);
        }
        styleToNodeMap.get(styleName)!.push(node.id);
      }
    }

    // Extraer valores directamente de los nodos
    if (node.fills && Array.isArray(node.fills)) {
      node.fills.forEach((fill) => {
        const color = extractColorFromFill(fill);
        if (color) {
          const tokenName = normalizeTokenName(node.name);
          if (tokenName && !tokens.colors.has(tokenName)) {
            tokens.colors.set(tokenName, color);
          }
        }
      });
    }

    if (node.style && node.style.fontSize) {
      const tokenName = normalizeTokenName(node.name);
      if (tokenName && !tokens.typography.has(tokenName)) {
        tokens.typography.set(tokenName, {
          fontSize: node.style.fontSize,
          fontWeight: node.style.fontWeight || 400,
          lineHeight: node.style.lineHeightPx || node.style.fontSize * 1.5,
          letterSpacing: node.style.letterSpacing,
          fontFamily: node.style.fontFamily,
        });
      }
    }

    if (node.effects && Array.isArray(node.effects)) {
      node.effects.forEach((effect) => {
        const shadow = extractShadowFromEffect(effect);
        if (shadow) {
          const tokenName = normalizeTokenName(node.name);
          if (tokenName && !tokens.shadows.has(tokenName)) {
            tokens.shadows.set(tokenName, shadow);
          }
        }
      });
    }

    if (node.cornerRadius !== undefined) {
      const tokenName = normalizeTokenName(node.name);
      if (tokenName && !tokens.borderRadius.has(tokenName)) {
        tokens.borderRadius.set(tokenName, node.cornerRadius);
      }
    }

    if (node.children) {
      node.children.forEach(collectNodeIds);
    }
  }

  collectNodeIds(figmaFile.document);

  return tokens;
}

function generateCSSVariables(tokens: DesignTokens): string {
  let css = `/* Design Tokens - BIA Design System */
/* Generado automáticamente desde Figma */

:root {
  /* Colors */
`;

  Array.from(tokens.colors.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([name, value]) => {
      css += `  --color-${name}: ${value};\n`;
    });

  css += `\n  /* Typography */\n`;
  
  Array.from(tokens.typography.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([name, value]) => {
      css += `  --font-size-${name}: ${value.fontSize}px;\n`;
      css += `  --font-weight-${name}: ${value.fontWeight};\n`;
      css += `  --line-height-${name}: ${value.lineHeight}px;\n`;
      if (value.letterSpacing) {
        css += `  --letter-spacing-${name}: ${value.letterSpacing}px;\n`;
      }
      if (value.fontFamily) {
        css += `  --font-family-${name}: ${value.fontFamily};\n`;
      }
    });

  css += `\n  /* Spacing */\n`;
  const sortedSpacing = Array.from(tokens.spacing.entries()).sort(([a], [b]) => a.localeCompare(b));
  if (sortedSpacing.length > 0) {
    sortedSpacing.forEach(([name, value]) => {
      css += `  --spacing-${name}: ${value}px;\n`;
    });
  } else {
    css += `  /* Spacing tokens will be added here */\n`;
  }

  css += `\n  /* Border Radius */\n`;
  const sortedRadius = Array.from(tokens.borderRadius.entries()).sort(([a], [b]) => a.localeCompare(b));
  if (sortedRadius.length > 0) {
    sortedRadius.forEach(([name, value]) => {
      css += `  --radius-${name}: ${value}px;\n`;
    });
  } else {
    css += `  /* Border radius tokens will be added here */\n`;
  }

  css += `\n  /* Shadows */\n`;
  Array.from(tokens.shadows.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([name, value]) => {
      const shadowValue = `${value.offsetX}px ${value.offsetY}px ${value.blurRadius}px ${value.spreadRadius}px ${value.color}`;
      css += `  --shadow-${name}: ${value.type === 'inner' ? 'inset ' : ''}${shadowValue};\n`;
    });

  css += `}\n`;
  return css;
}

function generateTailwindConfig(tokens: DesignTokens): string {
  let config = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./packages/*/src/**/*.{js,ts,jsx,tsx}",
    "./packages/*/src/**/*.{html,md}",
  ],
  theme: {
    extend: {
      colors: {
        // Tokens de color de Figma
`;

  Array.from(tokens.colors.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([name, value]) => {
      const tailwindName = name.replace(/-/g, '');
      config += `        '${tailwindName}': 'var(--color-${name})',\n`;
    });

  config += `      },
      spacing: {
        // Tokens de espaciado
`;

  const sortedSpacing = Array.from(tokens.spacing.entries()).sort(([a], [b]) => a.localeCompare(b));
  if (sortedSpacing.length > 0) {
    sortedSpacing.forEach(([name, value]) => {
      config += `        '${name}': 'var(--spacing-${name})',\n`;
    });
  } else {
    config += `        // Spacing tokens will be added here\n`;
  }

  config += `      },
      fontSize: {
        // Tokens de tipografía
`;

  Array.from(tokens.typography.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([name, value]) => {
      config += `        '${name}': [
          'var(--font-size-${name})',
          {
            lineHeight: 'var(--line-height-${name})',
            fontWeight: 'var(--font-weight-${name})',
          },
        ],\n`;
    });

  config += `      },
      borderRadius: {
        // Bordes redondeados
`;

  const sortedRadius = Array.from(tokens.borderRadius.entries()).sort(([a], [b]) => a.localeCompare(b));
  if (sortedRadius.length > 0) {
    sortedRadius.forEach(([name, value]) => {
      config += `        '${name}': 'var(--radius-${name})',\n`;
    });
  } else {
    config += `        // Border radius tokens will be added here\n`;
  }

  config += `      },
      boxShadow: {
        // Sombras
`;

  Array.from(tokens.shadows.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([name, value]) => {
      config += `        '${name}': 'var(--shadow-${name})',\n`;
    });

  config += `      },
    },
  },
  plugins: [],
}
`;

  return config;
}

function generateTypeScriptTypes(tokens: DesignTokens): string {
  let ts = `/**
 * Design Tokens - BIA Design System
 * Generado automáticamente desde Figma
 */

export interface ColorTokens {
`;

  Array.from(tokens.colors.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([name]) => {
      const tsName = name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      ts += `  '${tsName}': string;\n`;
    });

  ts += `}

export interface TypographyTokens {
`;

  Array.from(tokens.typography.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([name]) => {
      const tsName = name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      ts += `  '${tsName}': {
    fontSize: number;
    fontWeight: number;
    lineHeight: number;
    letterSpacing?: number;
    fontFamily?: string;
  };\n`;
    });

  ts += `}

export interface SpacingTokens {
`;

  const sortedSpacing = Array.from(tokens.spacing.entries()).sort(([a], [b]) => a.localeCompare(b));
  if (sortedSpacing.length > 0) {
    sortedSpacing.forEach(([name]) => {
      const tsName = name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      ts += `  '${tsName}': number;\n`;
    });
  } else {
    ts += `  // Spacing tokens will be added here\n`;
  }

  ts += `}

export interface BorderRadiusTokens {
`;

  const sortedRadius = Array.from(tokens.borderRadius.entries()).sort(([a], [b]) => a.localeCompare(b));
  if (sortedRadius.length > 0) {
    sortedRadius.forEach(([name]) => {
      const tsName = name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      ts += `  '${tsName}': number;\n`;
    });
  } else {
    ts += `  // Border radius tokens will be added here\n`;
  }

  ts += `}

export interface ShadowTokens {
`;

  Array.from(tokens.shadows.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([name]) => {
      const tsName = name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      ts += `  '${tsName}': {
    type: 'drop' | 'inner';
    offsetX: number;
    offsetY: number;
    blurRadius: number;
    spreadRadius: number;
    color: string;
  };\n`;
    });

  ts += `}

export interface DesignTokens {
  colors: ColorTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  borderRadius: BorderRadiusTokens;
  shadows: ShadowTokens;
}
`;

  return ts;
}

async function main() {
  const fileId = process.argv[2];
  const accessToken = process.argv[3];

  if (!fileId || !accessToken) {
    console.error('Uso: node extract-tokens-advanced.js <FIGMA_FILE_ID> <FIGMA_ACCESS_TOKEN>');
    process.exit(1);
  }

  try {
    console.log('🔗 Conectando a Figma y extrayendo tokens...\n');
    const figmaFile = await fetchFigmaFile(fileId, accessToken);

    console.log(`📄 Archivo: ${figmaFile.document.name}\n`);

    const tokens = extractTokensFromFile(figmaFile);

    console.log(`✅ Tokens extraídos:`);
    console.log(`   - Colores: ${tokens.colors.size}`);
    console.log(`   - Tipografía: ${tokens.typography.size}`);
    console.log(`   - Spacing: ${tokens.spacing.size}`);
    console.log(`   - Border Radius: ${tokens.borderRadius.size}`);
    console.log(`   - Sombras: ${tokens.shadows.size}\n`);

    const fs = await import('fs');
    const path = await import('path');

    const tokensDir = path.join(process.cwd(), 'packages/core/src/styles');
    const typesDir = path.join(process.cwd(), 'packages/core/src/types');
    
    if (!fs.existsSync(tokensDir)) {
      fs.mkdirSync(tokensDir, { recursive: true });
    }
    if (!fs.existsSync(typesDir)) {
      fs.mkdirSync(typesDir, { recursive: true });
    }

    const cssContent = generateCSSVariables(tokens);
    fs.writeFileSync(path.join(tokensDir, 'tokens.css'), cssContent);
    console.log('✅ Generado: packages/core/src/styles/tokens.css');

    const tailwindContent = generateTailwindConfig(tokens);
    fs.writeFileSync(path.join(process.cwd(), 'tailwind.config.js'), tailwindContent);
    console.log('✅ Actualizado: tailwind.config.js');

    const tsContent = generateTypeScriptTypes(tokens);
    fs.writeFileSync(path.join(typesDir, 'tokens.ts'), tsContent);
    console.log('✅ Generado: packages/core/src/types/tokens.ts');

    console.log('\n🎉 ¡Tokens extraídos y archivos generados exitosamente!');

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
