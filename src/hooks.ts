import { useQuery } from "@tanstack/react-query";
import { fetchDesk, fetchLoad } from "./api/desk";

export function useDesk() {
  return useQuery({ queryKey: ["desk"], queryFn: fetchDesk, refetchInterval: 60_000 });
}

export function useLoad(org: string | null | undefined, me: string | undefined) {
  return useQuery({
    queryKey: ["load", org],
    queryFn: () => fetchLoad(org!, me!),
    enabled: !!org && !!me,
    refetchInterval: 120_000,
  });
}
