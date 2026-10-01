/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Ativos locais (logo) são pequenos e estáticos — sem necessidade do
    // otimizador de imagem do Next (evita dependência nativa do sharp).
    unoptimized: true,
  },
};

export default nextConfig;
