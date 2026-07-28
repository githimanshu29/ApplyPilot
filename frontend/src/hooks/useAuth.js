import { useAuth as useAuthContext } from "../context/AuthContext";
import { useMutation } from "@tanstack/react-query";
import api from "../lib/api";

export function useAuth() {
  return useAuthContext();
}

// updates profile fields manually (used on profile page PUT)
export function useUpdateProfile() {
  const { refreshUser } = useAuthContext();

  return useMutation({
    mutationFn: (data) => api.put("/profile", data),
    onSuccess: () => refreshUser(),
  });
}

// phase 1 — upload PDF, get parsed preview back (does NOT save yet)
export function useUploadResume() {
  return useMutation({
    mutationFn: (file) => {
      const formData = new FormData();
      formData.append("resume", file);
      return api.post("/profile/upload-resume", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
  });
}

// phase 2 — user confirmed the parsed data, save to DB
export function useConfirmResume() {
  const { refreshUser } = useAuthContext();

  return useMutation({
    mutationFn: async (data) => {
      console.log("4. Calling backend");

      const res = await api.post("/profile/confirm-resume", data);

      console.log("5. Backend responded", res.status);

      return res;
    },

    onSuccess: async () => {
      console.log("6. Refreshing user");

      await refreshUser();

      console.log("7. User refreshed");
    },

    onError: (err) => {
      console.error("8. Mutation failed", err);
    },
  });
}
