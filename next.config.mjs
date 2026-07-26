/** @type {import('next').NextConfig} */
const nextConfig = {
  /** 避免部分仅浏览器可用的依赖被误打入服务端图 */
  transpilePackages: ["xlsx"],
};

export default nextConfig;
