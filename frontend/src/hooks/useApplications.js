import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";

// fetch all applications (kanban grouped + flat)
export function useApplications(filters = {}) {
  return useQuery({
    queryKey: ["applications", filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters).toString();
      const res = await api.get(`/applications${params ? "?" + params : ""}`);
      return res.data;
    },
  });
}

// fetch stats
export function useApplicationStats() {
  return useQuery({
    queryKey: ["applications", "stats"],
    queryFn: async () => {
      const res = await api.get("/applications/stats");
      return res.data.stats;
    },
  });
}

// fetch single application with full detail
export function useApplication(id) {
  return useQuery({
    queryKey: ["applications", id],
    queryFn: async () => {
      const res = await api.get(`/applications/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

// update status mutation
export function useUpdateStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) =>
      api.patch(`/applications/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });
}

// delete application
export function useDeleteApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/applications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });
}
