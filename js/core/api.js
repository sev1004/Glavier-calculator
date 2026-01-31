export async function fetchJson(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function makeAuthHeader(token) {
  const t = (token || "").trim();
  if (!t) return "";
  return t.toLowerCase().startsWith("bearer ") ? t : `bearer ${t}`;
}
