/** Category colors: bg + text chosen for WCAG AA contrast on light backgrounds (dark text on tinted bg). */
export const CATEGORY_COLORS = [
  { name: "blue", bg: "bg-blue-400/50 hover:bg-blue-400/70", text: "text-blue-900", border: "border-blue-200/20 hover:border-blue-200/40" },
  { name: "green", bg: "bg-green-400/50 hover:bg-green-400/70", text: "text-green-900", border: "border-green-200/20 hover:border-green-200/40" },
  { name: "purple", bg: "bg-purple-400/50 hover:bg-purple-400/70", text: "text-purple-900", border: "border-purple-200/20 hover:border-purple-200/40" },
  { name: "orange", bg: "bg-orange-400/50 hover:bg-orange-400/70", text: "text-orange-900", border: "border-orange-200/20 hover:border-orange-200/40" },
  { name: "red", bg: "bg-red-400/50 hover:bg-red-400/70", text: "text-red-900", border: "border-red-200/20 hover:border-red-200/40" },
  { name: "yellow", bg: "bg-amber-400/50 hover:bg-amber-400/70", text: "text-amber-900", border: "border-amber-200/20 hover:border-amber-200/40" },
  { name: "pink", bg: "bg-pink-400/50 hover:bg-pink-400/70", text: "text-pink-900", border: "border-pink-200/20 hover:border-pink-200/40" },
  { name: "gray", bg: "bg-gray-400/50 hover:bg-gray-400/70", text: "text-gray-900", border: "border-gray-200/20 hover:border-gray-200/40" },
] as const

export type CategoryColor = (typeof CATEGORY_COLORS)[number]
