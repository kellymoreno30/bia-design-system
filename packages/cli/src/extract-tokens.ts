/**
 * Script para extraer tokens de diseño de Figma con sus valores reales
 * Uso: node extract-tokens.js <FIGMA_FILE_ID> <FIGMA_ACCESS_TOKEN>
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
  style?: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    lineHeightPx?: number;
    letterSpacing?: number;
  };
  children?: FigmaNode[];
}

interface FigmaFill {
  type: string;
  color?: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
  gradientStops?: Array<{
    color: { r: number; g: number; b: number; a: number };
    position: number;
  }>;
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
  return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(a)}`;
}

function extractColorFromFill(fill: FigmaFill): string | null {
  if (fill.type === 'SOLID' && fill.color) {
    return rgbaToHex(fill.color.r, fill.color.g, fill.color.b, fill.color.a);
  }
  if (fill.type === 'GRADIENT_LINEAR' && fill.gradientStops && fill.gradientStops.length > 0) {
    // Para gradientes, tomamos el primer color
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
  // Convertir nombres como "Colors/Primary/500" a "primary-500"
  return name
    .toLowerCase()
    .replace(/\//g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function findPageByName(nodes: FigmaNode[], pageName: string): FigmaNode | null {
  for (const node of nodes) {
    if (node.type === 'CANVAS' && node.name.toLowerCase().includes(pageName.toLowerCase())) {
      return node;
    }
    if (node.children) {
      const found = findPageByName(node.children, pageName);
      if (found) return found;
    }
  }
  return null;
}

function extractTokensFromNodes(nodes: FigmaNode[], styles: Record<string, FigmaStyle>): DesignTokens {
  const tokens: DesignTokens = {
    colors: new Map(),
    typography: new Map(),
    spacing: new Map(),
    borderRadius: new Map(),
    shadows: new Map(),
  };

  // Buscar páginas específicas de Foundations
  const colorsPage = findPageByName(nodes, 'colors');
  const typographyPage = findPageByName(nodes, 'typography');
  const effectsPage = findPageByName(nodes, 'effect');
  const spacingPage = findPageByName(nodes, 'spacing');

  function traverse(node: FigmaNode, context: 'colors' | 'typography' | 'effects' | 'spacing' | 'general' = 'general') {
    // Extraer colores de fills (especialmente en la página de Colors)
    if ((context === 'colors' || context === 'general') && node.fills && Array.isArray(node.fills)) {
      node.fills.forEach((fill) => {
        const color = extractColorFromFill(fill);
        if (color) {
          // Usar el nombre del nodo o buscar en el estilo
          let tokenName = normalizeTokenName(node.name);
          
          // Si el nodo tiene un estilo asociado, usar ese nombre
          if (node.id && styles) {
            const styleEntry = Object.entries(styles).find(([_, style]) => 
              style.styleType === 'FILL' && style.name.toLowerCase().includes(node.name.toLowerCase())
            );
            if (styleEntry) {
              tokenName = normalizeTokenName(styleEntry[1].name);
            }
          }
          
          if (tokenName && !tokens.colors.has(tokenName)) {
            tokens.colors.set(tokenName, color);
          }
        }
      });
    }

    // Extraer tipografía (especialmente en la página de Typography)
    if ((context === 'typography' || context === 'general') && node.style && node.style.fontSize) {
      let tokenName = normalizeTokenName(node.name);
      
      // Si el nodo tiene un estilo de texto asociado, usar ese nombre
      if (node.id && styles) {
        const styleEntry = Object.entries(styles).find(([_, style]) => 
          style.styleType === 'TEXT' && style.name.toLowerCase().includes(node.name.toLowerCase())
        );
        if (styleEntry) {
          tokenName = normalizeTokenName(styleEntry[1].name);
        }
      }
      
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

    // Extraer sombras (especialmente en la página de Effects)
    if ((context === 'effects' || context === 'general') && node.effects && Array.isArray(node.effects)) {
      node.effects.forEach((effect) => {
        const shadow = extractShadowFromEffect(effect);
        if (shadow) {
          let tokenName = normalizeTokenName(node.name);
          
          // Si el nodo tiene un estilo de efecto asociado, usar ese nombre
          if (node.id && styles) {
            const styleEntry = Object.entries(styles).find(([_, style]) => 
              style.styleType === 'EFFECT' && style.name.toLowerCase().includes(node.name.toLowerCase())
            );
            if (styleEntry) {
              tokenName = normalizeTokenName(styleEntry[1].name);
            }
          }
          
          if (tokenName && !tokens.shadows.has(tokenName)) {
            tokens.shadows.set(tokenName, shadow);
          }
        }
      });
    }

    // Extraer border radius
    if ((node as any).cornerRadius !== undefined) {
      const tokenName = normalizeTokenName(node.name);
      if (tokenName && !tokens.borderRadius.has(tokenName)) {
        tokens.borderRadius.set(tokenName, (node as any).cornerRadius);
      }
    }

    // Extraer spacing (buscar en nodos con dimensiones específicas)
    if (context === 'spacing' && (node as any).width !== undefined) {
      const width = (node as any).width;
      const height = (node as any).height;
      // Si es un cuadrado pequeño, probablemente es un token de spacing
      if (width === height && width <= 128) {
        const tokenName = normalizeTokenName(node.name);
        if (tokenName && !tokens.spacing.has(tokenName)) {
          tokens.spacing.set(tokenName, width);
        }
      }
    }

    // Recursión para hijos con contexto apropiado
    if (node.children) {
      const childContext = 
        node.name.toLowerCase().includes('color') ? 'colors' :
        node.name.toLowerCase().includes('typography') || node.name.toLowerCase().includes('text') ? 'typography' :
        node.name.toLowerCase().includes('effect') || node.name.toLowerCase().includes('shadow') ? 'effects' :
        node.name.toLowerCase().includes('spacing') ? 'spacing' :
        context;
      
      node.children.forEach(child => traverse(child, childContext));
    }
  }

  // Procesar páginas específicas primero
  if (colorsPage) {
    traverse(colorsPage, 'colors');
  }
  if (typographyPage) {
    traverse(typographyPage, 'typography');
  }
  if (effectsPage) {
    traverse(effectsPage, 'effects');
  }
  if (spacingPage) {
    traverse(spacingPage, 'spacing');
  }

  // También procesar todos los nodos para capturar tokens que puedan estar en otros lugares
  nodes.forEach(node => traverse(node, 'general'));

  // Agregar tokens de estilos directamente si no se encontraron en los nodos
  Object.values(styles).forEach(style => {
    const tokenName = normalizeTokenName(style.name);
    
    if (style.styleType === 'FILL' && !tokens.colors.has(tokenName)) {
      // Intentar encontrar el valor en los nodos
      // Por ahora, marcamos que existe pero sin valor
    }
    
    if (style.styleType === 'TEXT' && !tokens.typography.has(tokenName)) {
      // Similar para tipografía
    }
    
    if (style.styleType === 'EFFECT' && !tokens.shadows.has(tokenName)) {
      // Similar para efectos
    }
  });

  return tokens;
}

async function fetchFigmaFile(fileId: string, accessToken: string) {
  const url = `https://api.figma.com/v1/files/${fileId}`;
  
  const response = await fetch(url, {
    headers: {
      'X-Figma-Token': accessToken,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Error al obtener el archivo: ${response.status} ${response.statusText}`;
    
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.err) {
        errorMessage += `\nDetalles: ${errorJson.err}`;
      }
    } catch {
      if (errorText) {
        errorMessage += `\nRespuesta: ${errorText}`;
      }
    }
    
    throw new Error(errorMessage);
  }

  return response.json() as Promise<FigmaFile>;
}

function generateCSSVariables(tokens: DesignTokens): string {
  let css = `/* Design Tokens - BIA Design System */
/* Generado automáticamente desde Figma */

:root {
  /* Colors */
`;

  // Colores
  const sortedColors = Array.from(tokens.colors.entries()).sort();
  sortedColors.forEach(([name, value]) => {
    css += `  --color-${name}: ${value};\n`;
  });

  css += `\n  /* Typography */\n`;
  
  // Tipografía
  const sortedTypography = Array.from(tokens.typography.entries()).sort();
  sortedTypography.forEach(([name, value]) => {
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
  
  // Spacing (si hay)
  const sortedSpacing = Array.from(tokens.spacing.entries()).sort();
  if (sortedSpacing.length > 0) {
    sortedSpacing.forEach(([name, value]) => {
      css += `  --spacing-${name}: ${value}px;\n`;
    });
  } else {
    css += `  /* Spacing tokens will be added here */\n`;
  }

  css += `\n  /* Border Radius */\n`;
  
  // Border Radius
  const sortedRadius = Array.from(tokens.borderRadius.entries()).sort();
  if (sortedRadius.length > 0) {
    sortedRadius.forEach(([name, value]) => {
      css += `  --radius-${name}: ${value}px;\n`;
    });
  } else {
    css += `  /* Border radius tokens will be added here */\n`;
  }

  css += `\n  /* Shadows */\n`;
  
  // Sombras
  const sortedShadows = Array.from(tokens.shadows.entries()).sort();
  sortedShadows.forEach(([name, value]) => {
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

  // Colores para Tailwind
  const sortedColors = Array.from(tokens.colors.entries()).sort();
  sortedColors.forEach(([name, value]) => {
    const tailwindName = name.replace(/-/g, '');
    config += `        '${tailwindName}': 'var(--color-${name})',\n`;
  });

  config += `      },
      spacing: {
        // Tokens de espaciado
`;

  // Spacing
  const sortedSpacing = Array.from(tokens.spacing.entries()).sort();
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

  // Tipografía
  const sortedTypography = Array.from(tokens.typography.entries()).sort();
  sortedTypography.forEach(([name, value]) => {
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

  // Border Radius
  const sortedRadius = Array.from(tokens.borderRadius.entries()).sort();
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

  // Sombras
  const sortedShadows = Array.from(tokens.shadows.entries()).sort();
  sortedShadows.forEach(([name, value]) => {
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

  // Colores
  const sortedColors = Array.from(tokens.colors.entries()).sort();
  sortedColors.forEach(([name]) => {
    const tsName = name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    ts += `  '${tsName}': string;\n`;
  });

  ts += `}

export interface TypographyTokens {
`;

  // Tipografía
  const sortedTypography = Array.from(tokens.typography.entries()).sort();
  sortedTypography.forEach(([name]) => {
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

  // Spacing
  const sortedSpacing = Array.from(tokens.spacing.entries()).sort();
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

  // Border Radius
  const sortedRadius = Array.from(tokens.borderRadius.entries()).sort();
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

  // Sombras
  const sortedShadows = Array.from(tokens.shadows.entries()).sort();
  sortedShadows.forEach(([name]) => {
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
    console.error('Uso: node extract-tokens.js <FIGMA_FILE_ID> <FIGMA_ACCESS_TOKEN>');
    process.exit(1);
  }

  try {
    console.log('🔗 Conectando a Figma y extrayendo tokens...\n');
    const figmaFile = await fetchFigmaFile(fileId, accessToken);

    console.log(`📄 Archivo: ${figmaFile.document.name}\n`);

    // Extraer tokens de los nodos
    const tokens = extractTokensFromNodes([figmaFile.document], figmaFile.styles || {});

    console.log(`✅ Tokens extraídos:`);
    console.log(`   - Colores: ${tokens.colors.size}`);
    console.log(`   - Tipografía: ${tokens.typography.size}`);
    console.log(`   - Spacing: ${tokens.spacing.size}`);
    console.log(`   - Border Radius: ${tokens.borderRadius.size}`);
    console.log(`   - Sombras: ${tokens.shadows.size}\n`);

    // Generar archivos
    const fs = await import('fs');
    const path = await import('path');

    // Crear directorios si no existen
    const tokensDir = path.join(process.cwd(), 'packages/core/src/styles');
    const typesDir = path.join(process.cwd(), 'packages/core/src/types');
    
    if (!fs.existsSync(tokensDir)) {
      fs.mkdirSync(tokensDir, { recursive: true });
    }
    if (!fs.existsSync(typesDir)) {
      fs.mkdirSync(typesDir, { recursive: true });
    }

    // Generar CSS
    const cssContent = generateCSSVariables(tokens);
    fs.writeFileSync(path.join(tokensDir, 'tokens.css'), cssContent);
    console.log('✅ Generado: packages/core/src/styles/tokens.css');

    // Generar Tailwind config
    const tailwindContent = generateTailwindConfig(tokens);
    fs.writeFileSync(path.join(process.cwd(), 'tailwind.config.js'), tailwindContent);
    console.log('✅ Actualizado: tailwind.config.js');

    // Generar TypeScript types
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
