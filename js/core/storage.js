const STORAGE_KEY = "loa_pat";

export function loadPat() {
  return localStorage.getItem(STORAGE_KEY) || "";
}

export function savePat(token) {
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearPat() {
  localStorage.removeItem(STORAGE_KEY);
}
