// Shared validation used by signup, checkout and the admin panel.
// An email is local@domain.tld; the local part may contain letters, digits, dots, dashes,
// underscores and plus signs (RFC 5322's common subset).
export function isEmail(s) {
  return /^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(s);
}
