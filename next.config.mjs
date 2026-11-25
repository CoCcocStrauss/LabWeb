/** @type {import('next').NextConfig} */
const nextConfig = {
  // ECS uses the Node server bundle; leave Netlify's build output unchanged.
  ...(process.env.LABWEB_DEPLOY_TARGET === "ecs" ? { output: "standalone" } : {}),
  /** 避免部分仅浏览器可用的依赖被误打入服务端图 */
  transpilePackages: ["xlsx"],
};

export default nextConfig;
