import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";

export function usePrepSession(applicationId) {
  return useQuery({
    queryKey: ["prep", applicationId],
    queryFn: async () => {
      const res = await api.get(`/prep/${applicationId}`);
      return res.data.session;
    },
    enabled: !!applicationId,
  });
}

export function useSubmitAnswer(applicationId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ questionIndex, userAnswer }) =>
      api.post(`/prep/${applicationId}/answer`, { questionIndex, userAnswer }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prep", applicationId] });
    },
  });
}
