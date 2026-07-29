import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";

export function useDiscoverJobs(query, location = "India") {
  return useQuery({
    queryKey: ["jobs", "discover", query, location],
    queryFn: async () => {
      const params = new URLSearchParams({ query, location }).toString();
      const res = await api.get(`/jobs/discover?${params}`);
      return res.data;
    },
    enabled: !!query,
    staleTime: 1000 * 60 * 5, // 5 minutes — don't re-fetch on every render
  });
}

export function useSavedJobs() {
  return useQuery({
    queryKey: ["jobs", "saved"],
    queryFn: async () => {
      const res = await api.get("/jobs");
      return res.data;
    },
  });
}

export function useScrapeJob() {
  return useMutation({
    mutationFn: (url) => api.post("/jobs/scrape", { url }),
  });
}

export function useSaveJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobData) => api.post("/jobs/save", jobData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useOptimizeJob() {
  return useMutation({
    mutationFn: ({ jobId, socketId }) =>
      api.post(`/jobs/${jobId}/optimize`, { socketId }),
    // no invalidation here — pipeline is async (202 Accepted)
    // JobsPage watches pipeline.result and invalidates only when BullMQ finishes
  });
}
