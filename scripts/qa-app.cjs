// 本地验收专用：显式覆盖数据库配置，绝不向真实 Supabase 写入测试记录。
const { spawn } = require("node:child_process");
const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), process.env.QA_DEV === "1" ? "dev" : "start", "-H", "127.0.0.1", "-p", "3210"], {
  stdio: "inherit",
  env: { ...process.env, SUPABASE_URL: "http://127.0.0.1:3211", SUPABASE_SERVICE_ROLE_KEY: "local-qa-only",
    HTTPS_PROXY: "", HTTP_PROXY: "", https_proxy: "", http_proxy: "" },
});
child.on("exit", code => { process.exitCode = code ?? 1; });
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
