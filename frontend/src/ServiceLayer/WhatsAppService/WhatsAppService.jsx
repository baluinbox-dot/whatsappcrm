import client from "@/lib/apiClient";

export const WhatsAppService = {
  getSettings: () => client.get("/whatsapp/settings").then((r) => r.data),
  saveSettings: (payload) => client.put("/whatsapp/settings", payload).then((r) => r.data),
  verify: () => client.post("/whatsapp/settings/verify").then((r) => r.data),
};

export const CustomerService = {
  getAll: (params) => client.get("/customers", { params }).then((r) => r.data),
  create: (payload) => client.post("/customers", payload).then((r) => r.data),
  update: (id, payload) => client.put(`/customers/${id}`, payload).then((r) => r.data),
  remove: (id) => client.delete(`/customers/${id}`).then((r) => r.data),
  assign: (id, userId) => client.put(`/customers/${id}/assign`, { userId }).then((r) => r.data),
  history: (id) => client.get(`/customers/${id}/history`).then((r) => r.data),
};

export const InboxService = {
  conversations: (params) => client.get("/inbox/conversations", { params }).then((r) => r.data),
  unreadCount: () => client.get("/inbox/unread-count").then((r) => r.data),
  messages: (customerId) => client.get(`/inbox/conversations/${customerId}/messages`).then((r) => r.data),
  send: (customerId, text) => client.post(`/inbox/conversations/${customerId}/messages`, { text }).then((r) => r.data),
};

export const NoteService = {
  getAll: (search) => client.get("/notes", { params: { search } }).then((r) => r.data),
  create: (payload) => client.post("/notes", payload).then((r) => r.data),
  update: (id, payload) => client.put(`/notes/${id}`, payload).then((r) => r.data),
  remove: (id) => client.delete(`/notes/${id}`).then((r) => r.data),
};

export const DashboardService = {
  get: () => client.get("/dashboard", { params: { tzOffset: new Date().getTimezoneOffset() } }).then((r) => r.data),
};
