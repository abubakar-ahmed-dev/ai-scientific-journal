import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMe } from "./api";
import type { UserProfile } from "./api";
import { useAuth } from "./firebase/authContext";

// Shared /me profile (react-query): display name, avatar signed URL, email,
// member-since, preferences. Single source of truth for the header avatar and
// the settings page — the Firebase Auth record is only the session. The uid is
// part of the query key so switching accounts never serves the previous
// account's cached profile.
export function useProfile() {
  const { currentUser } = useAuth();

  const query = useQuery({
    queryKey: ["profile", currentUser?.uid ?? "anonymous"],
    queryFn: async () => (await fetchMe()).data,
    enabled: !!currentUser,
    staleTime: 60 * 1000,
  });

  const email = currentUser?.email ?? query.data?.email ?? null;

  return {
    profile: query.data ?? null,
    // Auth displayName is a fallback until /me resolves (and for brand-new
    // accounts in the first paint).
    displayName: query.data?.displayName || currentUser?.displayName || email?.split("@")[0] || null,
    email,
    avatarUrl: query.data?.avatarUrl ?? null,
    memberSince: query.data?.createdAt ?? null,
    preferences: query.data?.preferences ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useInvalidateProfile() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["profile"] });
}

export type { UserProfile };
