export type ParsedAccountNumber = {
  raw: string;
  regionCode: string;
  worksiteCode: string;
  parts: string[];
};

export function parseAccountNumber(value: unknown): ParsedAccountNumber | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  const parts = raw.split('/').map((part) => part.trim());
  if (parts.length !== 5) return null;
  const valid = /^\d{2}$/.test(parts[0]) && /^\d{2}$/.test(parts[1]) && /^\d{3}$/.test(parts[2]) && /^\d{3}$/.test(parts[3]) && /^\d{2}$/.test(parts[4]);
  if (!valid) return null;
  return { raw, regionCode: parts[0], worksiteCode: parts[1], parts };
}
