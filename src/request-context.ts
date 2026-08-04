import { AsyncLocalStorage } from "node:async_hooks";

const basePathStorage = new AsyncLocalStorage<string>();

/**
 * ローカル/本番、直アクセス/リバースプロキシ経由のいずれでも同じコードで
 * 正しい内部リンクを組み立てられるように、リクエストのマウントプレフィックス
 * (例: wagaya.org/kinki-zoo/ 配下にプロキシされている場合は "/kinki-zoo")を
 * リクエストスコープで保持する。
 */
export function normalizeBasePath(headerValue: string | null): string {
  if (!headerValue) return "";
  const trimmed = headerValue.trim();
  if (trimmed === "" || trimmed === "/") return "";
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

export function runWithBasePath<T>(basePath: string, fn: () => T): T {
  return basePathStorage.run(basePath, fn);
}

export function getBasePath(): string {
  return basePathStorage.getStore() ?? "";
}

/** サイト内の絶対パス("/"始まり)に、現在のマウントプレフィックスを付与する。 */
export function withBase(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  return `${getBasePath()}${path}`;
}
