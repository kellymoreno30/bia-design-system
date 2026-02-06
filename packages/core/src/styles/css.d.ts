// Declaración de tipos para archivos CSS
declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}
