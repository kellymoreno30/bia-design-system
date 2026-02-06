import React from 'react';

export default function Home() {
  return (
    <div
      className="min-h-screen p-8 transition-colors duration-200"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      <header className="flex items-center justify-between mb-12">
        <h1 className="text-3xl font-bold">BIA Design System</h1>
        <button
          id="theme-toggle"
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: 'var(--bg-button-brand-primary)',
            color: 'var(--text-primary-button)',
          }}
        >
          Toggle theme
        </button>
      </header>

      {/* Text colors */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          Text Colors
        </h2>
        <div className="space-y-2">
          <p style={{ color: 'var(--text-primary)' }}>text-primary</p>
          <p style={{ color: 'var(--text-secondary)' }}>text-secondary</p>
          <p style={{ color: 'var(--text-tertiary)' }}>text-tertiary</p>
          <p style={{ color: 'var(--text-quaternary)' }}>text-quaternary</p>
          <p style={{ color: 'var(--text-disabled)' }}>text-disabled</p>
          <p style={{ color: 'var(--text-brand-primary)' }}>text-brand-primary</p>
          <p style={{ color: 'var(--text-brand-secondary)' }}>text-brand-secondary</p>
          <p style={{ color: 'var(--text-error-primary)' }}>text-error-primary</p>
          <p style={{ color: 'var(--text-success-primary)' }}>text-success-primary</p>
          <p style={{ color: 'var(--text-warning-primary)' }}>text-warning-primary</p>
        </div>
      </section>

      {/* Background colors */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">Background Colors</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            'bg-primary',
            'bg-secondary',
            'bg-tertiary',
            'bg-quaternary',
            'bg-brand-solid',
            'bg-error-primary',
            'bg-success-primary',
            'bg-warning-primary',
          ].map((token) => (
            <div
              key={token}
              className="h-20 rounded-lg flex items-end p-2"
              style={{
                backgroundColor: `var(--${token})`,
                border: '1px solid var(--border-secondary)',
              }}
            >
              <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                {token}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Border colors */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">Border Colors</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            'border-primary',
            'border-secondary',
            'border-tertiary',
            'border-brand',
            'border-error',
            'border-disabled',
          ].map((token) => (
            <div
              key={token}
              className="h-16 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: 'var(--bg-primary)',
                border: `2px solid var(--${token})`,
              }}
            >
              <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                {token}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Theme toggle script */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.getElementById('theme-toggle')?.addEventListener('click', function() {
              var html = document.documentElement;
              var current = html.getAttribute('data-theme') || 'light';
              var next = current === 'light' ? 'dark' : 'light';
              html.setAttribute('data-theme', next);
              try { localStorage.setItem('bia-theme', next); } catch(e) {}
            });
            // Init from localStorage or system preference
            (function() {
              try {
                var saved = localStorage.getItem('bia-theme');
                if (saved === 'light' || saved === 'dark') {
                  document.documentElement.setAttribute('data-theme', saved);
                  return;
                }
              } catch(e) {}
              if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.setAttribute('data-theme', 'dark');
              }
            })();
          `,
        }}
      />
    </div>
  );
}
