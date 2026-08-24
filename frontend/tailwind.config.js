/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sidebar: '#3B1D7A',
        'sidebar-hover': 'rgba(255,255,255,0.1)',
        'sidebar-active': 'rgba(255,255,255,0.18)',
        brand: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
          950: '#3b0764',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      keyframes: {
        // Entrada das cenas e dos graficos do painel institucional. Vivem aqui
        // e nao em CSS solto para o Tailwind purgar junto com o resto.
        barra: {
          '0%': { transform: 'scaleX(0)', opacity: '0.4' },
          '100%': { transform: 'scaleX(1)', opacity: '1' },
        },
        coluna: {
          '0%': { transform: 'scaleY(0)' },
          '100%': { transform: 'scaleY(1)' },
        },
        traco: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        cena: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        barra: 'barra 0.75s cubic-bezier(0.22,1,0.36,1) both',
        coluna: 'coluna 0.6s cubic-bezier(0.22,1,0.36,1) both',
        traco: 'traco 0.9s ease-out both',
        cena: 'cena 0.45s cubic-bezier(0.22,1,0.36,1) both',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.1)',
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [],
}
