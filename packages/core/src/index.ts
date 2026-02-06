// Bia Design System - Core Package
export * from './components';
export { type PrimitiveColorToken, type TextColorToken, type BgColorToken, type BorderColorToken, type FgColorToken, type EffectToken, type UtilityColorToken, type AlphaToken, type SemanticToken, type DesignTokens } from './types/tokens';
export { type Theme, getTheme, setTheme, toggleTheme, initTheme } from './lib/theme-toggle';

// Importar estilos (para que estén disponibles cuando se importe el paquete)
import './styles/index.css';
