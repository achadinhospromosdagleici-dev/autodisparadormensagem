export function normalizeUrl(url: string): string {
  if (!url) return url;
  url = url.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url.replace(/\/+$/, '');
}
