export const API_BASE =
  import.meta.env.VITE_API_URL || "/api";

async function req(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  events: (filter = "all") => req(`/events?filter=${filter}`),
  event: (id) => req(`/events/${id}`),
  resources: (category) =>
    req(category ? `/resources?category=${category}` : "/resources"),
  resource: (id) => req(`/resources/${id}`),
  announcements: () => req("/announcements"),
};

export function getToken() {
  return localStorage.getItem("soup_admin_token") || "";
}

export async function adminLogin(username, password) {
  const data = await req("/admin/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  localStorage.setItem("soup_admin_token", data.token);
  return data;
}

export function adminLogout() {
  localStorage.removeItem("soup_admin_token");
}

function adminReq(path, method, body) {
  return req(path, {
    method,
    headers: { Authorization: `Bearer ${getToken()}` },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export const adminApi = {
  create: (table, body) => adminReq(`/admin/${table}`, "POST", body),
  update: (table, id, body) => adminReq(`/admin/${table}/${id}`, "PUT", body),
  remove: (table, id) => adminReq(`/admin/${table}/${id}`, "DELETE"),
};

export function fmtDate(iso) {
  if (!iso) return "";
  // The API returns DATE columns as full ISO timestamps
  // ("2024-04-26T04:00:00.000Z"); the demo mock serves plain "YYYY-MM-DD".
  // Take just the date part so both render the same day in any timezone.
  const datePart = String(iso).slice(0, 10);
  const d = new Date(`${datePart}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = Number(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${m} ${ampm}`;
}

export function spotsLeft(e) {
  if (e.spots_total == null) return null;
  return Math.max(0, e.spots_total - (e.spots_taken || 0));
}

// Photo fallback for deploys without the club's photo files on disk.
// The photos are binary, so they can't travel through a text-only Git
// push; when a local /images/* file 404s, try the club's own public repo
// (same files, same names) before giving up. Returns true when it swapped
// in a fallback URL, false when there is nothing left to try.
const RAW_BASE =
  "https://raw.githubusercontent.com/Jemimahosei/CornellSOUP/main";
const RAW_OVERRIDES = {
  "161-things2.jpg":
    "design-plan/SOUP-provided-content/161-things2.jpg",
  "ctf3.jpg": "design-plan/SOUP-provided-content/ctf3.jpg",
  "manhunt2.jpg": "design-plan/SOUP-provided-content/manhunt2.jpg",
};
export function imgFallback(e) {
  const img = e.currentTarget;
  if (!img) return false;
  const file = (img.getAttribute("src") || "").split("/").pop();
  if (!file) return false;
  // Track the fallback per file, not per element: the home carousel
  // reuses one <img> across slides, so a flag on the element alone
  // would let the first slide's fallback block every later slide.
  if (img.dataset.rawFallbackFor === file) return false;
  img.dataset.rawFallbackFor = file;
  img.src = `${RAW_BASE}/${RAW_OVERRIDES[file] || `images/${file}`}`;
  return true;
}
