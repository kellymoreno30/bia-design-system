# Estilos del Sistema de Diseño BIA

Este directorio contiene los tokens de diseño extraídos desde Figma.

## Archivos

- `tokens.css` - Variables CSS con todos los tokens de diseño
- `index.css` - Archivo de entrada que importa los tokens

## Uso

### En aplicaciones React/Next.js

```tsx
// En tu archivo principal (layout.tsx, _app.tsx, etc.)
import '@bia-design-system/core/src/styles/index.css';
```

### En aplicaciones con bundler (Webpack, Vite, etc.)

```tsx
// En tu archivo de entrada
import '@bia-design-system/core/src/styles/index.css';
```

### Usando variables CSS directamente

```css
.mi-componente {
  color: var(--color-base-black);
  font-size: var(--font-size-text-md-regular);
  box-shadow: var(--shadow-shadows-shadow-md);
}
```

### Usando con Tailwind CSS

Los tokens están configurados en `tailwind.config.js` y puedes usarlos así:

```tsx
<div className="bg-baseblack text-display-lg-semibold shadow-shadows-shadow-md">
  Contenido
</div>
```

## Tokens disponibles

- **Colores**: `--color-*` (162 tokens)
- **Tipografía**: `--font-size-*`, `--font-weight-*`, `--line-height-*`, etc. (45 tokens)
- **Sombras**: `--shadow-*` (14 tokens)
- **Border Radius**: `--radius-*` (2 tokens)
