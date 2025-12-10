import { supabase } from "./supabase";

export interface Subscription {
  id: string;
  url: string;
  name: string;
  status: string;
  checkInterval: number;
  lastCheckedAt: string | null;
  lastContentHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function createSubscription(url: string, name: string): Promise<Subscription> {
  const { data, error } = await supabase
    .from("subscriptions")
    .insert({
      url,
      name,
      status: "active",
      check_interval: 60,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapToSubscription(data);
}

export async function deleteSubscription(id: string): Promise<void> {
  const { error } = await supabase.from("subscriptions").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getSubscriptions(): Promise<Subscription[]> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map(mapToSubscription);
}

export async function getSubscriptionByUrl(url: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("url", url)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapToSubscription(data) : null;
}

function mapToSubscription(data: Record<string, unknown>): Subscription {
  return {
    id: data.id as string,
    url: data.url as string,
    name: data.name as string,
    status: data.status as string,
    checkInterval: data.check_interval as number,
    lastCheckedAt: data.last_checked_at as string | null,
    lastContentHash: data.last_content_hash as string | null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}
