// Renvoie l'URL seulement si elle est sûre (http/https), sinon undefined.
// Empêche l'exécution de liens javascript:/data: stockés (XSS via href).
export function safeUrl(u) {
  if (!u) return undefined;
  return /^https?:\/\//i.test(String(u).trim()) ? u : undefined;
}
