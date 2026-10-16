import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Permite abrir el dev server a través de un Dev Tunnel de VS Code.
  allowedDevOrigins: ["*.devtunnels.ms"],
  serverExternalPackages: ["cloudinary"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
      allowedOrigins: ["*.devtunnels.ms"],
    },
  },
  images: {
    remotePatterns: [
      // El logo del comprobante lo aloja Facturapi (spec 31), en un bucket de Google
      // Cloud Storage — confirmado con un `logo_url` real:
      // https://storage.googleapis.com/cdn.facturapi.io/organization/<uid>/logo.<ext>.
      // El host real es `storage.googleapis.com`; se restringe además el `pathname`
      // al bucket de Facturapi, en vez de abrir todo Google Cloud Storage.
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/cdn.facturapi.io/**",
      },
      // Fotos de tratamientos subidas por app/api/upload (spec 81, spec 83). Se acepta
      // cualquier cuenta (`*` = cloud name) porque hay fotos guardadas en más de una; solo
      // `image/upload`, para que `image/fetch` no vuelva el optimizador un proxy abierto.
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/*/image/upload/**",
      },
    ],
  },
};

export default nextConfig;
