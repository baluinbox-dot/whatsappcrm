import client from "@/lib/apiClient";

const tzOffset = () => new Date().getTimezoneOffset();

export const LeadService = {
  getAll: (params) => client.get("/leads", { params }).then((r) => r.data),
  counts: () => client.get("/leads/counts").then((r) => r.data),
  get: (id) => client.get(`/leads/${id}`).then((r) => r.data),
  create: (payload) => client.post("/leads", payload).then((r) => r.data),
  update: (id, payload) => client.put(`/leads/${id}`, payload).then((r) => r.data),
  assign: (id, userId) => client.put(`/leads/${id}/assign`, { userId }).then((r) => r.data),
  bulkAssign: (leadIds, userIds) => client.put("/leads/bulk-assign", { leadIds, userIds }).then((r) => r.data),
  importLeads: (payload) => client.post("/leads/import", payload).then((r) => r.data),
  setStatus: (id, payload) => client.put(`/leads/${id}/status`, payload).then((r) => r.data),
  remove: (id) => client.delete(`/leads/${id}`).then((r) => r.data),
  timeline: (id) => client.get(`/leads/${id}/timeline`).then((r) => r.data),
  addActivity: (id, payload) => client.post(`/leads/${id}/activities`, payload).then((r) => r.data),
  followUps: (id) => client.get(`/leads/${id}/follow-ups`).then((r) => r.data),
  addFollowUp: (id, payload) => client.post(`/leads/${id}/follow-ups`, payload).then((r) => r.data),
};

export const FollowUpService = {
  getAll: (params) => client.get("/follow-ups", { params: { ...params, tzOffset: tzOffset() } }).then((r) => r.data),
  counts: () => client.get("/follow-ups/counts", { params: { tzOffset: tzOffset() } }).then((r) => r.data),
  complete: (id, result) => client.put(`/follow-ups/${id}/done`, { result }).then((r) => r.data),
  remove: (id) => client.delete(`/follow-ups/${id}`).then((r) => r.data),
};
