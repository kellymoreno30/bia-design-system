/**
 * Script para obtener información del archivo de Figma
 * Uso: node figma-fetch.js <FIGMA_FILE_ID> <FIGMA_ACCESS_TOKEN>
 */

interface FigmaFile {
  document: {
    id: string;
    name: string;
    type: string;
    children: FigmaNode[];
  };
  components: Record<string, FigmaComponent>;
  styles: Record<string, FigmaStyle>;
}

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
}

interface FigmaComponent {
  key: string;
  name: string;
  description: string;
  componentSetId?: string;
}

interface FigmaStyle {
  key: string;
  name: string;
  styleType: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID';
  description: string;
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
      // Si no es JSON, usar el texto tal cual
      if (errorText) {
        errorMessage += `\nRespuesta: ${errorText}`;
      }
    }
    
    if (response.status === 403) {
      errorMessage += '\n\nPosibles causas:';
      errorMessage += '\n- El token no tiene acceso a este archivo';
      errorMessage += '\n- El archivo está en un equipo privado';
      errorMessage += '\n- El token necesita permisos adicionales';
      errorMessage += '\n- Verifica que el FILE_ID sea correcto';
    }
    
    throw new Error(errorMessage);
  }

  return response.json() as Promise<FigmaFile>;
}

function extractPages(document: FigmaNode): FigmaNode[] {
  const pages: FigmaNode[] = [];
  
  function traverse(node: FigmaNode) {
    if (node.type === 'CANVAS') {
      pages.push(node);
    }
    if (node.children) {
      node.children.forEach(traverse);
    }
  }
  
  traverse(document);
  return pages;
}

function extractComponents(nodes: FigmaNode[], components: Record<string, FigmaComponent>): FigmaComponent[] {
  const foundComponents: FigmaComponent[] = [];
  
  function traverse(node: FigmaNode) {
    if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
      // Buscar el componente en el registro
      const componentKey = Object.keys(components).find(key => {
        const component = components[key];
        return component.name === node.name;
      });
      
      if (componentKey) {
        foundComponents.push(components[componentKey]);
      }
    }
    if (node.children) {
      node.children.forEach(traverse);
    }
  }
  
  nodes.forEach(traverse);
  return foundComponents;
}

function extractDesignTokens(styles: Record<string, FigmaStyle>) {
  const tokens = {
    colors: [] as FigmaStyle[],
    typography: [] as FigmaStyle[],
    effects: [] as FigmaStyle[],
    grids: [] as FigmaStyle[],
  };

  Object.values(styles).forEach(style => {
    switch (style.styleType) {
      case 'FILL':
        tokens.colors.push(style);
        break;
      case 'TEXT':
        tokens.typography.push(style);
        break;
      case 'EFFECT':
        tokens.effects.push(style);
        break;
      case 'GRID':
        tokens.grids.push(style);
        break;
    }
  });

  return tokens;
}

async function main() {
  const fileId = process.argv[2];
  const accessToken = process.argv[3];

  if (!fileId || !accessToken) {
    console.error('Uso: node figma-fetch.js <FIGMA_FILE_ID> <FIGMA_ACCESS_TOKEN>');
    console.error('\nPara obtener el FILE_ID:');
    console.error('1. Abre tu archivo en Figma');
    console.error('2. Copia la URL (ejemplo: https://www.figma.com/file/ABC123xyz/BIA-PULSE)');
    console.error('3. El FILE_ID es la parte "ABC123xyz"');
    process.exit(1);
  }

  try {
    console.log('🔗 Conectando a Figma...\n');
    const figmaFile = await fetchFigmaFile(fileId, accessToken);

    console.log(`📄 Archivo: ${figmaFile.document.name}\n`);

    // Extraer páginas
    const pages = extractPages(figmaFile.document);
    console.log('📑 PÁGINAS ENCONTRADAS:');
    console.log('─'.repeat(50));
    pages.forEach((page, index) => {
      console.log(`${index + 1}. ${page.name}`);
    });
    console.log(`\nTotal: ${pages.length} página(s)\n`);

    // Extraer componentes
    const components = extractComponents([figmaFile.document], figmaFile.components || {});
    console.log('🧩 COMPONENTES PRINCIPALES:');
    console.log('─'.repeat(50));
    if (components.length > 0) {
      components.forEach((component, index) => {
        console.log(`${index + 1}. ${component.name}`);
        if (component.description) {
          console.log(`   ${component.description}`);
        }
      });
    } else {
      console.log('No se encontraron componentes principales.');
    }
    console.log(`\nTotal: ${components.length} componente(s)\n`);

    // Extraer tokens de diseño
    const tokens = extractDesignTokens(figmaFile.styles || {});
    console.log('🎨 TOKENS DE DISEÑO:');
    console.log('─'.repeat(50));
    
    if (tokens.colors.length > 0) {
      console.log(`\nColores (${tokens.colors.length}):`);
      tokens.colors.forEach(token => {
        console.log(`  • ${token.name}`);
      });
    }
    
    if (tokens.typography.length > 0) {
      console.log(`\nTipografía (${tokens.typography.length}):`);
      tokens.typography.forEach(token => {
        console.log(`  • ${token.name}`);
      });
    }
    
    if (tokens.effects.length > 0) {
      console.log(`\nEfectos/Sombras (${tokens.effects.length}):`);
      tokens.effects.forEach(token => {
        console.log(`  • ${token.name}`);
      });
    }
    
    if (tokens.grids.length > 0) {
      console.log(`\nGrids (${tokens.grids.length}):`);
      tokens.grids.forEach(token => {
        console.log(`  • ${token.name}`);
      });
    }

    const totalTokens = tokens.colors.length + tokens.typography.length + 
                       tokens.effects.length + tokens.grids.length;
    
    if (totalTokens === 0) {
      console.log('\n⚠️  No se encontraron tokens de diseño en el archivo.');
      console.log('   Los tokens deben estar definidos como estilos en Figma.');
    } else {
      console.log(`\nTotal: ${totalTokens} token(s) de diseño`);
    }

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
