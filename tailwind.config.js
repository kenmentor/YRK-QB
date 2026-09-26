/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"]
      },
      borderRadius: { xl: "0.9rem", lg: "0.75rem", md: "0.5rem", sm: "0.375rem" },
      boxShadow: {
        soft: "0 1px 2px rgba(15,23,42,0.05), 0 4px 16px -4px rgba(15,23,42,0.08)",
        lift: "0 2px 4px rgba(15,23,42,0.06), 0 12px 32px -8px rgba(15,23,42,0.16)"
      },
      colors: {
        brand: {
          50: "#f1eefe",
          100: "#e2d9fb",
          200: "#c0b3f0",
          300: "#a58ef0",
          400: "#8b6fe8",
          500: "#7853da",
          600: "#6a3fd6",
          700: "#5f3cbe",
          800: "#4e31a0",
          900: "#3f277f"
        }
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};
