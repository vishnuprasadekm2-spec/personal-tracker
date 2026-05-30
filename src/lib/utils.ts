export function getLocalDateString() {
  return new Date().toISOString().slice(0, 10);
}

export function fmtDate(iso: string) {
  // Returns formatted local date e.g. Friday, May 29, 2026
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

export function escBrand(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
