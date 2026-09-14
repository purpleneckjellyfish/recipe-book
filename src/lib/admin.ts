/** App-level admins (not household Owner). Comma-separated emails in ADMIN_EMAILS. */

const DEFAULT_ADMIN_EMAILS = ["davidpkemble@pm.me"];

function adminEmailSet() {
  const raw = process.env.ADMIN_EMAILS?.trim();
  const list = raw
    ? raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
    : DEFAULT_ADMIN_EMAILS;
  return new Set(list);
}

export function isAppAdmin(email: string | null | undefined) {
  if (!email) return false;
  return adminEmailSet().has(email.trim().toLowerCase());
}
