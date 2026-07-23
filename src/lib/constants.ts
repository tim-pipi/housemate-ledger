export const CATEGORIES = [
  "Rent",
  "Utilities",
  "Internet",
  "Groceries",
  "Household",
  "Food",
  "Other",
] as const;

export const MEMBER_COLORS = [
  "#0E7C6B", // teal
  "#B4632C", // rust
  "#3F5E9E", // indigo
  "#8A5FA0", // plum
  "#4E7A32", // olive
  "#A34E68", // rose
];

export function fmtSGD(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}S$${(Math.abs(cents) / 100).toFixed(2)}`;
}
