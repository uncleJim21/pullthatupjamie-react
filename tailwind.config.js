// tailwind.config.js
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      boxShadow: {
        'white-glow': '0 0 10px rgba(255, 255, 255, 0.8)',
      },
      keyframes: {
        'tooltip-expand': {
          '0%': { 
            opacity: '0', 
            transform: 'scaleY(0.8)' 
          },
          '100%': { 
            opacity: '1', 
            transform: 'scaleY(1)' 
          },
        },
        'slide-in-right': {
          '0%': {
            opacity: '0',
            transform: 'translateX(100%)'
          },
          '100%': {
            opacity: '1',
            transform: 'translateX(0)'
          },
        },
      },
      animation: {
        'tooltip-expand': 'tooltip-expand 0.15s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
      },
      typography: (theme) => ({
        invert: {
          css: {
            '--tw-prose-body': theme('colors.gray.300'),
            '--tw-prose-headings': theme('colors.white'),
            '--tw-prose-links': theme('colors.blue.400'),
            '--tw-prose-bold': theme('colors.white'),
            '--tw-prose-bullets': theme('colors.gray.600'),
            '--tw-prose-quotes': theme('colors.gray.100'),
            '--tw-prose-code': theme('colors.white'),
            '--tw-prose-pre-bg': theme('colors.gray.900'),
            '--tw-prose-th-borders': theme('colors.gray.600'),
            '--tw-prose-td-borders': theme('colors.gray.700'),
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
