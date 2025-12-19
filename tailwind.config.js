/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: '#FAFAF8', // Warm Off-White
                surface: '#FFFFFF',    // Pure White
                primary: '#2180EA',    // Teal Blue (Primary Action)
                'primary-dark': '#1C6DC4', // Hover State
                secondary: '#2B8C7E',  // Teal Green (Success/Secondary)
                accent: '#F59E0B',     // Amber (Warning/Attention)
                error: '#DC2626',      // Red (Error)
                'primary-text': '#134252', // Dark Navy
                'secondary-text': '#627C81', // Medium Gray
                'neutral-bg': '#F5F5F5', // Very Light Gray (User Request)
                'border-light': '#D1D5D8', // Light Gray (Borders/Tracks)
                subtle: 'rgba(0, 0, 0, 0.08)', // Subtle border
                glass: {
                    100: 'rgba(255, 255, 255, 0.1)',
                    200: 'rgba(255, 255, 255, 0.2)',
                    300: 'rgba(255, 255, 255, 0.3)',
                }
            },
            boxShadow: {
                'card': '0 1px 3px rgba(0,0,0,0.08)',
                'card-hover': '0 4px 12px rgba(0,0,0,0.12)',
                'primary-btn': '0 2px 8px rgba(33, 128, 234, 0.2)',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-out',
                'slide-up': 'slideUp 0.5s ease-out',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'sliding-progress': 'slidingProgress 2s ease-in-out infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(20px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                slidingProgress: {
                    '0%': { left: '-33.33%', width: '33.33%' },
                    '50%': { left: '33.33%', width: '66.66%' },
                    '100%': { left: '100%', width: '33.33%' },
                },
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'hero-glow': 'conic-gradient(from 180deg at 50% 50%, #2a8af6 0deg, #a853ba 180deg, #e92a67 360deg)',
            }
        },
    },
    plugins: [],
}
