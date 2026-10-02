export type ThemePreset = {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  background: string;
  text: string;
  font: string;
  emoji: string;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "coffee",
    name: "Coffee",
    primary: "#7c2d12",
    secondary: "#d6a86c",
    background: "#fbf6ee",
    text: "#1c1917",
    font: "Inter",
    emoji: "☕",
  },
  {
    id: "restaurant",
    name: "Restaurant",
    primary: "#b91c1c",
    secondary: "#fbbf24",
    background: "#fff7ed",
    text: "#1c1917",
    font: "Inter",
    emoji: "🍽️",
  },
  {
    id: "salon",
    name: "Salon",
    primary: "#be185d",
    secondary: "#f9a8d4",
    background: "#fdf2f8",
    text: "#1c1917",
    font: "Inter",
    emoji: "💇",
  },
  {
    id: "hotel",
    name: "Hotel",
    primary: "#0f172a",
    secondary: "#cbd5e1",
    background: "#f8fafc",
    text: "#0f172a",
    font: "Inter",
    emoji: "🏨",
  },
  {
    id: "retail",
    name: "Retail",
    primary: "#1d4ed8",
    secondary: "#93c5fd",
    background: "#eff6ff",
    text: "#0f172a",
    font: "Inter",
    emoji: "🛍️",
  },
  {
    id: "modern",
    name: "Modern",
    primary: "#0f172a",
    secondary: "#22d3ee",
    background: "#f1f5f9",
    text: "#0f172a",
    font: "Inter",
    emoji: "✨",
  },
  {
    id: "luxury",
    name: "Luxury",
    primary: "#1f2937",
    secondary: "#d4af37",
    background: "#faf7f0",
    text: "#111827",
    font: "Inter",
    emoji: "👑",
  },
  {
    id: "minimal",
    name: "Minimal",
    primary: "#111827",
    secondary: "#9ca3af",
    background: "#ffffff",
    text: "#111827",
    font: "Inter",
    emoji: "◻️",
  },
];

export function getTheme(id: string) {
  return THEME_PRESETS.find((t) => t.id === id) || THEME_PRESETS[0];
}
