import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (userData) => api.post("/auth/register", userData),
  login: (credentials) => api.post("/auth/login", credentials),
};

export const mindMapAPI = {
  getAll: (params = {}) => api.get("/mindmaps", { params }),
  getById: (id) => api.get(`/mindmaps/${id}`),
  create: (mindMapData) => api.post("/mindmaps", mindMapData),
  update: (id, mindMapData) => api.put(`/mindmaps/${id}`, mindMapData),
  delete: (id) => api.delete(`/mindmaps/${id}`),
  addComment: (id, nodeId, commentData) =>
    api.post(`/mindmaps/${id}/comments/${nodeId}`, commentData),
  addCollaborator: (id, collaboratorData) =>
    api.post(`/mindmaps/${id}/collaborators`, collaboratorData),
};

export default api;
