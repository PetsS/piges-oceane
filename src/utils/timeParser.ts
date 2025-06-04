
/**
 * Parses a time string like "90", "1:30", or "00:01:30" into seconds.
 */
export function parseTimeString(input: string): number {
  const parts = input.trim().split(":").map(Number);
  if (parts.length === 1) return parts[0] || 0;
  if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
  if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  return 0;
}
