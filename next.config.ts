import type { NextConfig } from "next";

/**
 * Cloud name de Cloudinary: lo que sigue al "@" en CLOUDINARY_URL
 * (cloudinary://<api_key>:<api_secret>@<cloud_name>). La key y el secret nunca se copian.
 * `remotePatterns` se fija en `next build` / `next dev`: si cambia la cuenta de
 * Cloudinary hay que volver a construir.
 */
const cloudinaryCloudName = process.env.CLOUDINARY_URL?.split("@")[1]?.trim();

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
      // Fotos de tratamientos subidas por app/api/upload (spec 81).
      ...(cloudinaryCloudName
        ? [
            {
              protocol: "https" as const,
              hostname: "res.cloudinary.com",
              pathname: `/${cloudinaryCloudName}/**`,
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
