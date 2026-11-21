import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ProxyAgent, fetch as undiciFetch } from "undici";

// 代理仅用于本客户端。使用同一版本的undici fetch与ProxyAgent，
// 避免Next.js/Node内置fetch的dispatcher协议不同导致请求失败。
let client: SupabaseClient | undefined;

/** 仅服务端使用；密钥不能出现在浏览器代码或公开配置中。 */
export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase server config: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!client) {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy ||
      process.env.HTTP_PROXY || process.env.http_proxy;
    const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
    const proxiedFetch: typeof fetch = (input, init) => undiciFetch(
      input as unknown as Parameters<typeof undiciFetch>[0],
      { ...init, dispatcher } as Parameters<typeof undiciFetch>[1],
    ) as unknown as Promise<Response>;
    client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
      ...(dispatcher ? { global: { fetch: proxiedFetch } } : {}),
    });
  }
  return client;
}
