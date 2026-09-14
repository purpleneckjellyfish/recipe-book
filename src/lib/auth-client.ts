import { createAuthClient } from "better-auth/react";

/** Always same-origin so LAN/Unraid IPs work without a baked-in build URL. */
export const authClient = createAuthClient();
