import { env } from "../env";
import { supabase } from "../supabase";

export class ApiError extends Error {
  constructor(
    public message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function getAuthToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export const apiClient = async <T>(url: string, options: RequestInit): Promise<T> => {
  const fullUrl = `${env.API_SERVER_URL}${url}`;

  const token = await getAuthToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (token) {
    (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }

  const response = await fetch(fullUrl, { ...options, headers });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(error.message ?? response.statusText, response.status);
  }

  if (response.status === 204) {
    return { status: response.status, data: null } as T;
  }

  const data = await response.json();
  return { status: response.status, data } as T;
};
