import client from "@/lib/apiClient";

export const PropertyService = {
  getAll: (params) => client.get("/properties", { params }).then((r) => r.data),
  get: (id) => client.get(`/properties/${id}`).then((r) => r.data),
  create: (payload) => client.post("/properties", payload).then((r) => r.data),
  update: (id, payload) => client.put(`/properties/${id}`, payload).then((r) => r.data),
  remove: (id) => client.delete(`/properties/${id}`).then((r) => r.data),
  upload: (id, kind, files) => {
    const form = new FormData();
    form.append("kind", kind);
    files.forEach((f) => form.append("files", f));
    return client.post(`/properties/${id}/files`, form, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
  },
  setCover: (fileId) => client.put(`/properties/files/${fileId}/cover`).then((r) => r.data),
  removeFile: (fileId) => client.delete(`/properties/files/${fileId}`).then((r) => r.data),
};

export const ServiceCatalogService = {
  getAll: (params) => client.get("/services", { params }).then((r) => r.data),
  create: (payload) => client.post("/services", payload).then((r) => r.data),
  update: (id, payload) => client.put(`/services/${id}`, payload).then((r) => r.data),
  remove: (id) => client.delete(`/services/${id}`).then((r) => r.data),
};

export const ProjectService = {
  getAll: (params) => client.get("/projects", { params }).then((r) => r.data),
  get: (id) => client.get(`/projects/${id}`).then((r) => r.data),
  create: (payload) => client.post("/projects", payload).then((r) => r.data),
  update: (id, payload) => client.put(`/projects/${id}`, payload).then((r) => r.data),
  remove: (id) => client.delete(`/projects/${id}`).then((r) => r.data),
};
