export const CATEGORY_COLORS = [
  { name: "blue", bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" },
  { name: "green", bg: "bg-green-100", text: "text-green-700", border: "border-green-200" },
  { name: "purple", bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200" },
  { name: "orange", bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200" },
  { name: "red", bg: "bg-red-100", text: "text-red-700", border: "border-red-200" },
  { name: "yellow", bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-200" },
  { name: "pink", bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-200" },
  { name: "gray", bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-200" },
] as const

export type CategoryColor = (typeof CATEGORY_COLORS)[number]
