export function normalizePhoneValue(input, defaultCountryCode = '98') {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  let digits = trimmed.replace(/[^\d]/g, '');
  if (!digits || trimmed.length > 32) return null;
  if (trimmed.startsWith('+')) {
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = `${defaultCountryCode}${digits.slice(1)}`;
  else if (digits.length === 10 && defaultCountryCode === '98') digits = `98${digits}`;
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}
