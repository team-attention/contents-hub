import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  findByUrlContentItem,
  getFindAllContentItemQueryKey,
  useCreateContentItem,
  useFindAllContentItem,
  useRemoveContentItem,
} from "../lib/api/__generated__/api";
import type { ContentItemResponseDto } from "../lib/api/__generated__/models";

export function useContentItems() {
  const queryClient = useQueryClient();

  const { data, isLoading, error: queryError } = useFindAllContentItem();

  const createMutation = useCreateContentItem();
  const removeMutation = useRemoveContentItem();

  const contentItems = data?.data.items ?? [];
  const error = queryError
    ? queryError instanceof Error
      ? queryError
      : new Error("Unknown error")
    : null;
  const isOperating = createMutation.isPending || removeMutation.isPending;

  const save = useCallback(
    async (url: string, title?: string): Promise<ContentItemResponseDto> => {
      const response = await createMutation.mutateAsync({
        data: { url, title },
      });
      queryClient.invalidateQueries({ queryKey: getFindAllContentItemQueryKey() });
      return response.data;
    },
    [createMutation, queryClient],
  );

  const remove = useCallback(
    async (id: string) => {
      await removeMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getFindAllContentItemQueryKey() });
    },
    [removeMutation, queryClient],
  );

  const isSaved = useCallback(
    (url: string) => contentItems.some((item) => item.url === url),
    [contentItems],
  );

  const getContentItemForUrl = useCallback(
    (url: string) => contentItems.find((item) => item.url === url) ?? null,
    [contentItems],
  );

  const checkContentItem = useCallback(async (url: string) => {
    try {
      const response = await findByUrlContentItem({ url });
      return response.data;
    } catch {
      return null;
    }
  }, []);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getFindAllContentItemQueryKey() });
  }, [queryClient]);

  return {
    contentItems,
    isLoading,
    error,
    isOperating,
    save,
    remove,
    isSaved,
    getContentItemForUrl,
    checkContentItem,
    refresh,
  };
}
