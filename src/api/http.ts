import { API_TIMEOUT_MS } from "../config";

export class ApiError extends Error {
  readonly kind: "timeout" | "network" | "invalid" | "http";
  readonly status?: number;

  constructor(
    kind: ApiError["kind"],
    message: string,
    status?: number,
  ) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new ApiError(
        "http",
        `Сервер вернул ошибку ${response.status}`,
        response.status,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError("invalid", "Сервер вернул некорректный ответ");
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("timeout", "Превышено время ожидания сервера");
    }

    throw new ApiError("network", "Соединение с сервером отсутствует");
  } finally {
    window.clearTimeout(timer);
  }
}
