import client from "@/lib/apiClient";

export const EmailService = {
  getSettings: () => client.get("/email/settings").then((r) => r.data),
  saveSettings: (payload) => client.put("/email/settings", payload).then((r) => r.data),
  verify: () => client.post("/email/settings/verify").then((r) => r.data),
  conversations: (params) => client.get("/email/conversations", { params }).then((r) => r.data),
  unreadCount: () => client.get("/email/unread-count").then((r) => r.data),
  emails: (customerId) => client.get(`/email/conversations/${customerId}/emails`).then((r) => r.data),
  send: (customerId, subject, body) =>
    client.post(`/email/conversations/${customerId}/emails`, { subject, body }).then((r) => r.data),
};
