import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  findByUrlSubscription,
  getFindAllSubscriptionQueryKey,
  useCreateSubscription,
  useFindAllSubscription,
  useRemoveSubscription,
} from "../lib/api/__generated__/api";

export function useSubscriptions() {
  const queryClient = useQueryClient();

  const { data, isLoading, error: queryError } = useFindAllSubscription();

  const createMutation = useCreateSubscription();
  const removeMutation = useRemoveSubscription();

  const subscriptions = data?.data.items ?? [];
  const error = queryError
    ? queryError instanceof Error
      ? queryError
      : new Error("Unknown error")
    : null;
  const isOperating = createMutation.isPending || removeMutation.isPending;

  const subscribe = useCallback(
    async (url: string, name: string) => {
      const response = await createMutation.mutateAsync({
        data: { url, name, checkInterval: 60 },
      });
      queryClient.invalidateQueries({ queryKey: getFindAllSubscriptionQueryKey() });
      return response.data;
    },
    [createMutation, queryClient],
  );

  const unsubscribe = useCallback(
    async (id: string) => {
      await removeMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getFindAllSubscriptionQueryKey() });
    },
    [removeMutation, queryClient],
  );

  const isSubscribed = useCallback(
    (url: string) => subscriptions.some((s) => s.url === url),
    [subscriptions],
  );

  const getSubscriptionForUrl = useCallback(
    (url: string) => subscriptions.find((s) => s.url === url) ?? null,
    [subscriptions],
  );

  const checkSubscription = useCallback(async (url: string) => {
    try {
      const response = await findByUrlSubscription({ url });
      return response.data;
    } catch {
      return null;
    }
  }, []);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getFindAllSubscriptionQueryKey() });
  }, [queryClient]);

  return {
    subscriptions,
    isLoading,
    error,
    isOperating,
    subscribe,
    unsubscribe,
    isSubscribed,
    getSubscriptionForUrl,
    checkSubscription,
    refresh,
  };
}
