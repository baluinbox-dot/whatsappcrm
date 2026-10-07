import axios from "axios";

export const TOKEN_KEY = "wsm_token";
export const USER_KEY = "wsm_user";

export const DB_KEY = "wsm_db";

// One API per database. VITE_DB_OPTIONS limits what the login page offers, e.g. "postgres" on the Ubuntu server.
const ENABLED = (import.meta.env.VITE_DB_OPTIONS || "mssql,postgres").split(",").map((s) => s.trim());
export const DB_OPTIONS = [
  { value: "mssql", label: "MS SQL Server", url: import.meta.env.VITE_API_URI },
  { value: "postgres", label: "PostgreSQL", url: import.meta.env.VITE_API_URI_PG },
].filter((o) => o.url && ENABLED.includes(o.value));

export const getDb = () => {
  const saved = localStorage.getItem(DB_KEY);
  return DB_OPTIONS.some((o) => o.value === saved) ? saved : DB_OPTIONS[0]?.value;
};
export const setDb = (value) => localStorage.setItem(DB_KEY, value);
export const apiBase = () => DB_OPTIONS.find((o) => o.value === getDb())?.url ?? import.meta.env.VITE_API_URI;

const apiClient = axios.create({
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  config.baseURL = apiBase();
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// An expired/invalid token (or a suspended company) drops the user back to the login screen.
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 && !location.pathname.startsWith("/login")) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const apiError = (err, fallback) => {
  const d = err?.response?.data;
  return d?.message || d?.detail || (d?.errors && Object.values(d.errors).flat()[0]) || fallback;
};

export default apiClient;
