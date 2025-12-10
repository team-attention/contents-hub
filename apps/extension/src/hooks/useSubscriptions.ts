import { useCallback, useEffect, useState } from "react";
import {
  type Subscription,
  createSubscription,
  deleteSubscription,
  getSubscriptionByUrl,
  getSubscriptions,
} from "../lib/subscriptions";

interface SubscriptionsState {
  subscriptions: Subscription[];
  isLoading: boolean;
  error: Error | null;
}

export function useSubscriptions() {
  const [state, setState] = useState<SubscriptionsState>({
    subscriptions: [],
    isLoading: true,
    error: null,
  });
  const [isOperating, setIsOperating] = useState(false);

  const fetchSubscriptions = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const subscriptions = await getSubscriptions();
      setState({ subscriptions, isLoading: false, error: null });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error("Unknown error"),
      }));
    }
  }, []);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const subscribe = useCallback(async (url: string, name: string) => {
    setIsOperating(true);
    try {
      const newSubscription = await createSubscription(url, name);
      setState((prev) => ({
        ...prev,
        subscriptions: [newSubscription, ...prev.subscriptions],
      }));
      return newSubscription;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error("Unknown error"),
      }));
      throw error;
    } finally {
      setIsOperating(false);
    }
  }, []);

  const unsubscribe = useCallback(async (id: string) => {
    setIsOperating(true);
    try {
      await deleteSubscription(id);
      setState((prev) => ({
        ...prev,
        subscriptions: prev.subscriptions.filter((s) => s.id !== id),
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error("Unknown error"),
      }));
      throw error;
    } finally {
      setIsOperating(false);
    }
  }, []);

  const isSubscribed = useCallback(
    (url: string) => {
      return state.subscriptions.some((s) => s.url === url);
    },
    [state.subscriptions],
  );

  const getSubscriptionForUrl = useCallback(
    (url: string) => {
      return state.subscriptions.find((s) => s.url === url) || null;
    },
    [state.subscriptions],
  );

  const checkSubscription = useCallback(async (url: string) => {
    try {
      return await getSubscriptionByUrl(url);
    } catch {
      return null;
    }
  }, []);

  return {
    ...state,
    isOperating,
    subscribe,
    unsubscribe,
    isSubscribed,
    getSubscriptionForUrl,
    checkSubscription,
    refresh: fetchSubscriptions,
  };
}
