export const productColors = [
  "Qora — #000000",
  "Oq — #FFFFFF",
  "Kulrang — #808080",
  "To'q ko'k (Navy) — #000080",
  "Ko'k — #2563EB",
  "Bej (Beige) — #F5F5DC",
  "Jigarrang — #8B4513",
  "Qizil — #DC2626",
  "Yashil — #16A34A",
  "Zaytun rangi (Olive) — #556B2F",
  "Bordoviy (Maroon) — #800000",
  "Pushti — #EC4899",
  "Binafsha — #7C3AED",
  "Xaki (Khaki) — #C3B091",
  "To'q sariq — #F97316",
];

export const normalizeProductOptions = (value) => (Array.isArray(value) ? value : value ? [value] : []);

export const colorDetails = (value) => {
  const match = value.match(/^(.*?)\s*[—–-]\s*(#[\da-fA-F]{6})$/);
  return {
    name: match?.[1] || value,
    hex: match?.[2] || '#D6D3D1',
  };
};
