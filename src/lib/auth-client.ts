import { createAuthClient } from "better-auth/react";

// Prefer same-origin so Unraid/LAN IPs work. NEXT_PUBLIC_APP_URL is only used
// when set at build time (e.g. a fixed public domain).
export const authClient = createAuthClient(
  process.env.NEXT_PUBLIC_APP_URL
    ? { baseURL: process.env.NEXT_PUBLIC_APP_URL }
    : {},
);
