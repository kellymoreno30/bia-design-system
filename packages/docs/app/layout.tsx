import React from 'react';
// Importar tokens de diseño
import '../../core/src/styles/index.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
