import client from "@/lib/apiClient";

export const AuthService = {
  login: (email, password) => client.post("/auth/login", { email, password }).then((r) => r.data),
  staffLogin: (adminEmail, mobileNo, password) =>
    client.post("/auth/staff-login", { adminEmail, mobileNo, password }).then((r) => r.data),
  signup: (payload) => client.post("/auth/signup", payload).then((r) => r.data),
  me: () => client.get("/auth/me").then((r) => r.data),
  forgotPassword: (email) => client.post("/auth/forgot-password", { email }).then((r) => r.data),
  resetPassword: (token, password) => client.post("/auth/reset-password", { token, password }).then((r) => r.data),
};

export const StaffService = {
  getAll: (search) => client.get("/staff", { params: { search } }).then((r) => r.data),
  create: (payload) => client.post("/staff", payload).then((r) => r.data),
  update: (id, payload) => client.put(`/staff/${id}`, payload).then((r) => r.data),
};

export const SuperAdminService = {
  companies: (params) => client.get("/superadmin/companies", { params }).then((r) => r.data),
  setStatus: (id, status) => client.put(`/superadmin/companies/${id}/status`, { status }).then((r) => r.data),
};
