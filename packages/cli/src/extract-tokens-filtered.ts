/**
 * Script optimizado para extraer solo tokens de diseño relevantes de Figma
 * Filtra tokens de las páginas de Foundations y usa estilos de Figma
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

function isValidTokenName(name: string): boolean {
  const normalized = normalizeTokenName(name);
  
  // Filtrar nombres que parecen ser tokens de diseño
  // Deben contener palabras clave comunes o seguir patrones de tokens
  const tokenPatterns = [
    /^(color|text|display|heading|body|label|caption|font|size|weight|line|height|letter|spacing|shadow|radius|spacing|gap|padding|margin|border)/,
    /^(primary|secondary|accent|neutral|success|warning|error|info|background|foreground|surface|border|divider)/,
    /^(xs|sm|md|lg|xl|2xl|3xl|4xl|5xl)$/,
    /^\d+$/, // Números simples pueden ser tokens de escala
    /^(regular|medium|semibold|bold|light|thin|extrabold|black)$/,
  ];
  
  // Excluir nombres que parecen ser contenido específico
  const excludePatterns = [
    /^\d{1,2}$/, // Números muy pequeños probablemente no son tokens
    /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i, // Fechas
    /min|read|hour|day|week|month|year/i, // Tiempo
    /^[a-z]$/, // Letras individuales
    /illustration|image|photo|picture|icon|logo|avatar/i, // Contenido
  ];
  
  // Si coincide con un patrón de exclusión, no es válido
  if (excludePatterns.some(pattern => pattern.test(normalized))) {
    return false;
  }
  
  // Si coincide con un patrón de token, es válido
  if (tokenPatterns.some(pattern => pattern.test(normalized))) {
    return true;
  }
  
  // Si el nombre tiene estructura de token (ej: "color-primary-500")
  if (normalized.includes('-') && normalized.split('-').length >= 2) {
    return true;
  }
  
  return false;
}

function findPageByName(nodes: FigmaNode[], pageName: string): FigmaNode | null {
  for (const node of nodes) {
    if (node.type === 'CANVAS') {
      const nodeNameLower = node.name.toLowerCase();
      if (nodeNameLower.includes(pageName.toLowerCase()) || 
          nodeNameLower === pageName.toLowerCase()) {
        return node;
      }
    }
    if (node.children) {
      const found = findPageByName(node.children, pageName);
      if (found) return found;
    }
  }
  return null;
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

function extractTokensFromFile(figmaFile: FigmaFile): DesignTokens {
  const tokens: DesignTokens = {
    colors: new Map(),
    typography: new Map(),
    spacing: new Map(),
    borderRadius: new Map(),
    shadows: new Map(),
  };

  // Buscar páginas de Foundations
  const colorsPage = findPageByName([figmaFile.document], 'colors');
  const typographyPage = findPageByName([figmaFile.document], 'typography');
  const effectsPage = findPageByName([figmaFile.document], 'effect');
  const spacingPage = findPageByName([figmaFile.document], 'spacing');
  const radiusPage = findPageByName([figmaFile.document], 'radius');

  // Mapa para rastrear valores por nombre de estilo
  const styleValues = new Map<string, { type: 'color' | 'typography' | 'shadow' | 'radius'; value: any }>();

  function extractFromNode(node: FigmaNode, context: 'colors' | 'typography' | 'effects' | 'spacing' | 'radius' | 'general') {
    const nodeName = node.name.toLowerCase();
    
    // Solo procesar si estamos en el contexto correcto o si el nombre parece un token válido
    const shouldProcess = 
      context !== 'general' || 
      isValidTokenName(node.name) ||
      (node.styles && (node.styles.fill || node.styles.text || node.styles.effect));

    if (!shouldProcess && context === 'general') {
      if (node.children) {
        node.children.forEach(child => extractFromNode(child, context));
      }
      return;
    }

    // Extraer colores
    if ((context === 'colors' || context === 'general') && node.fills && Array.isArray(node.fills)) {
      node.fills.forEach((fill) => {
        const color = extractColorFromFill(fill);
        if (color) {
          let tokenName = normalizeTokenName(node.name);
          
          // Si tiene un estilo asociado, usar el nombre del estilo
          if (node.styles?.fill && figmaFile.styles[node.styles.fill]) {
            tokenName = normalizeTokenName(figmaFile.styles[node.styles.fill].name);
          }
          
          if (tokenName && isValidTokenName(tokenName) && !tokens.colors.has(tokenName)) {
            tokens.colors.set(tokenName, color);
            styleValues.set(tokenName, { type: 'color', value: color });
          }
        }
      });
    }

    // Extraer tipografía
    if ((context === 'typography' || context === 'general') && node.style && node.style.fontSize) {
      let tokenName = normalizeTokenName(node.name);
      
      if (node.styles?.text && figmaFile.styles[node.styles.text]) {
        tokenName = normalizeTokenName(figmaFile.styles[node.styles.text].name);
      }
      
      if (tokenName && isValidTokenName(tokenName) && !tokens.typography.has(tokenName)) {
        tokens.typography.set(tokenName, {
          fontSize: node.style.fontSize,
          fontWeight: node.style.fontWeight || 400,
          lineHeight: node.style.lineHeightPx || node.style.fontSize * 1.5,
          letterSpacing: node.style.letterSpacing,
          fontFamily: node.style.fontFamily,
        });
        styleValues.set(tokenName, { type: 'typography', value: tokens.typography.get(tokenName)! });
      }
    }

    // Extraer sombras
    if ((context === 'effects' || context === 'general') && node.effects && Array.isArray(node.effects)) {
      node.effects.forEach((effect) => {
        const shadow = extractShadowFromEffect(effect);
        if (shadow) {
          let tokenName = normalizeTokenName(node.name);
          
          if (node.styles?.effect && figmaFile.styles[node.styles.effect]) {
            tokenName = normalizeTokenName(figmaFile.styles[node.styles.effect].name);
          }
          
          if (tokenName && isValidTokenName(tokenName) && !tokens.shadows.has(tokenName)) {
            tokens.shadows.set(tokenName, shadow);
            styleValues.set(tokenName, { type: 'shadow', value: shadow });
          }
        }
      });
    }

    // Extraer border radius
    if ((context === 'radius' || context === 'general') && node.cornerRadius !== undefined) {
      const tokenName = normalizeTokenName(node.name);
      if (tokenName && isValidTokenName(tokenName) && !tokens.borderRadius.has(tokenName)) {
        tokens.borderRadius.set(tokenName, node.cornerRadius);
        styleValues.set(tokenName, { type: 'radius', value: node.cornerRadius });
      }
    }

    // Extraer spacing (cuadrados pequeños en página de spacing)
    if (context === 'spacing' && node.width !== undefined && node.height !== undefined) {
      if (node.width === node.height && node.width <= 128 && node.width >= 4) {
        const tokenName = normalizeTokenName(node.name);
        if (tokenName && isValidTokenName(tokenName) && !tokens.spacing.has(tokenName)) {
          tokens.spacing.set(tokenName, node.width);
          styleValues.set(tokenName, { type: 'radius', value: node.width });
        }
      }
    }

    if (node.children) {
      const childContext = 
        nodeName.includes('color') ? 'colors' :
        nodeName.includes('typography') || nodeName.includes('text') || nodeName.includes('font') ? 'typography' :
        nodeName.includes('effect') || nodeName.includes('shadow') ? 'effects' :
        nodeName.includes('spacing') || nodeName.includes('gap') || nodeName.includes('padding') || nodeName.includes('margin') ? 'spacing' :
        nodeName.includes('radius') || nodeName.includes('border') ? 'radius' :
        context;
      
      node.children.forEach(child => extractFromNode(child, childContext));
    }
  }

  // Procesar páginas específicas primero
  if (colorsPage) {
    extractFromNode(colorsPage, 'colors');
  }
  if (typographyPage) {
    extractFromNode(typographyPage, 'typography');
  }
  if (effectsPage) {
    extractFromNode(effectsPage, 'effects');
  }
  if (spacingPage) {
    extractFromNode(spacingPage, 'spacing');
  }
  if (radiusPage) {
    extractFromNode(radiusPage, 'radius');
  }

  // También procesar estilos directamente de Figma
  Object.values(figmaFile.styles || {}).forEach(style => {
    const tokenName = normalizeTokenName(style.name);
    
    if (!isValidTokenName(tokenName)) {
      return;
    }

    // Si ya tenemos un valor para este estilo, no hacer nada
    if (styleValues.has(tokenName)) {
      return;
    }

    // Los estilos de Figma no tienen valores directamente, pero podemos marcarlos
    // para que se busquen en los nodos
  });

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
      // Crear nombres más legibles para Tailwind
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
    console.error('Uso: node extract-tokens-filtered.js <FIGMA_FILE_ID> <FIGMA_ACCESS_TOKEN>');
    process.exit(1);
  }

  try {
    console.log('🔗 Conectando a Figma y extrayendo tokens filtrados...\n');
    const figmaFile = await fetchFigmaFile(fileId, accessToken);

    console.log(`📄 Archivo: ${figmaFile.document.name}\n`);

    const tokens = extractTokensFromFile(figmaFile);

    console.log(`✅ Tokens extraídos (filtrados):`);
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
