"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addPantryStaple,
  addMealType,
  createInvite,
  joinWithInvite,
  removePantryStaple,
  renameHousehold,
  setMealTypeEnabled,
} from "@/app/(app)/household/actions";

export function HouseholdControls({
  isOwner,
  householdName,
  pantry,
  invites,
  mealTypes,
}: {
  isOwner: boolean;
  householdName: string;
  pantry: { id: string; name: string }[];
  invites: { id: string; code: string; expiresAt: string | null }[];
  mealTypes: { id: string; name: string; enabled: boolean }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [name, setName] = useState(householdName);
  const [staple, setStaple] = useState("");
  const [mealName, setMealName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  function refresh(fn: () => Promise<void>) {
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="space-y-4">
      {isOwner ? (
        <div className="surface rounded-[1.5rem] p-5">
          <h2 className="font-display text-xl font-bold">Household name</h2>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              refresh(() => renameHousehold(name));
            }}
          >
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn btn-primary shrink-0" disabled={pending}>
              Save
            </button>
          </form>
        </div>
      ) : null}

      <div className="surface rounded-[1.5rem] p-5">
        <h2 className="font-display text-xl font-bold">Invites</h2>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          Share a code so family can join this kitchen.
        </p>
        {isOwner ? (
          <button
            type="button"
            className="btn btn-primary mt-3 text-sm"
            disabled={pending}
            onClick={() =>
              refresh(async () => {
                const code = await createInvite();
                setInviteCode(code);
              })
            }
          >
            Create invite code
          </button>
        ) : null}
        {inviteCode ? (
          <p className="mt-3 rounded-xl bg-[var(--leaf-soft)] px-3 py-2 font-mono text-sm">
            New code: <strong>{inviteCode}</strong>
          </p>
        ) : null}
        {invites.length > 0 ? (
          <ul className="mt-3 space-y-1 text-sm">
            {invites.map((i) => (
              <li key={i.id} className="font-mono">
                {i.code}
              </li>
            ))}
          </ul>
        ) : null}

        <form
          className="mt-4 flex gap-2 border-t border-[var(--line)] pt-4"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            refresh(async () => {
              await joinWithInvite(joinCode);
              setMsg("Joined household");
              setJoinCode("");
            });
          }}
        >
          <input
            className="field"
            placeholder="Have a code? Join another kitchen"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
          />
          <button className="btn btn-ghost shrink-0" disabled={pending}>
            Join
          </button>
        </form>
      </div>

      <div className="surface rounded-[1.5rem] p-5">
        <h2 className="font-display text-xl font-bold">Meal types</h2>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          What appears on the week plan — evening main by default; add breakfast
          or lunch if you want them planned too.
        </p>
        <ul className="mt-3 space-y-2">
          {mealTypes.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-white/60 px-3 py-3 text-sm"
            >
              <span className="font-medium">
                {m.name}
                {!m.enabled ? (
                  <span className="ml-2 text-[var(--ink-soft)]">(off)</span>
                ) : null}
              </span>
              {isOwner ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-[var(--leaf-deep)]"
                  disabled={pending}
                  onClick={() =>
                    refresh(() => setMealTypeEnabled(m.id, !m.enabled))
                  }
                >
                  {m.enabled ? "Turn off" : "Turn on"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {isOwner ? (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              refresh(async () => {
                await addMealType(mealName);
                setMealName("");
              });
            }}
          >
            <input
              className="field"
              placeholder="e.g. Breakfast"
              value={mealName}
              onChange={(e) => setMealName(e.target.value)}
            />
            <button className="btn btn-primary shrink-0" disabled={pending}>
              Add
            </button>
          </form>
        ) : null}
      </div>

      <div className="surface rounded-[1.5rem] p-5">
        <h2 className="font-display text-xl font-bold">Pantry staples</h2>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            refresh(async () => {
              await addPantryStaple(staple);
              setStaple("");
            });
          }}
        >
          <input
            className="field"
            placeholder="e.g. soy sauce"
            value={staple}
            onChange={(e) => setStaple(e.target.value)}
          />
          <button className="btn btn-primary shrink-0" disabled={pending}>
            Add
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {pantry.map((p) => (
            <button
              key={p.id}
              type="button"
              className="chip"
              title="Remove"
              disabled={pending}
              onClick={() => refresh(() => removePantryStaple(p.id))}
            >
              {p.name} ×
            </button>
          ))}
        </div>
      </div>

      {msg ? <p className="text-sm text-[var(--leaf-deep)]">{msg}</p> : null}
    </div>
  );
}
