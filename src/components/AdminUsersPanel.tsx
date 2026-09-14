export function AdminUsersPanel({
  viewerEmail,
  users,
}: {
  viewerEmail: string;
  users: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    kitchens: { name: string; role: string }[];
  }[];
}) {
  return (
    <section className="surface rounded-[1.5rem] border border-[var(--leaf-soft)] p-5">
      <p className="chip mb-2">Admin only</p>
      <h2 className="font-display text-xl font-bold">All users</h2>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">
        Visible only on your admin account ({viewerEmail}). Everyone else only
        sees their own kitchen members.
      </p>
      <ul className="mt-4 space-y-2">
        {users.map((u) => (
          <li
            key={u.id}
            className="rounded-2xl bg-white/60 px-3 py-3 sm:flex sm:items-start sm:justify-between sm:gap-4"
          >
            <div className="min-w-0">
              <p className="font-semibold">{u.name}</p>
              <p className="truncate text-xs text-[var(--ink-soft)]">{u.email}</p>
              <p className="mt-1 text-xs text-[var(--ink-soft)]">
                Joined {new Date(u.createdAt).toLocaleDateString("en-GB")}
              </p>
            </div>
            <div className="mt-2 sm:mt-0 sm:text-right">
              {u.kitchens.length === 0 ? (
                <p className="text-xs text-[var(--ink-soft)]">No kitchen</p>
              ) : (
                u.kitchens.map((k) => (
                  <p key={`${u.id}-${k.name}-${k.role}`} className="text-xs">
                    <span className="font-medium">{k.name}</span>
                    <span className="text-[var(--ink-soft)]"> · {k.role}</span>
                  </p>
                ))
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-[var(--ink-soft)]">{users.length} accounts</p>
    </section>
  );
}
