import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ProxyAgent, setGlobalDispatcher } from "undici";

// 部分开发机（如国内网络）需要通过本地代理才能访问 Supabase。
// Node 的 fetch/undici 不会像 curl 那样自动读取 http_proxy/https_proxy，
// 这里手动接管一次，仅在检测到代理环境变量时生效；线上环境通常不设置该变量，不受影响。
let proxyConfigured = false;
function ensureProxyDispatcher(): void {
  if (proxyConfigured) return;
  proxyConfigured = true;
  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;
  if (proxyUrl) {
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
  }
}

let client: SupabaseClient | undefined;

/**
 * 仅供服务端使用的 Supabase 客户端（service role key，拥有绕过 RLS 的写权限）。
 * 严禁在任何 "use client" 组件或浏览器可达的代码路径中导入本文件。
 */
export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase server config: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  ensureProxyDispatcher();

  if (!client) {
    client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  return client;
}
