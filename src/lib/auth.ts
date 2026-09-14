import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./prisma";
import { categoryCreateData } from "./categories";
import {
  gateSignUp,
  takePendingInviteHousehold,
} from "./signup-gate";

const DEFAULT_MEAL_TYPES = [{ name: "Evening main", slug: "evening-main" }];

const DEFAULT_PANTRY = [
  "salt",
  "pepper",
  "olive oil",
  "vegetable oil",
  "butter",
  "garlic",
];

function originList(...values: Array<string | undefined>) {
  const out = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    for (const part of value.split(",")) {
      const trimmed = part.trim().replace(/\/$/, "");
      if (trimmed) out.add(trimmed);
    }
  }
  return [...out];
}

export async function bootstrapHousehold(userId: string, userName: string) {
  const existing = await prisma.householdMember.findFirst({
    where: { userId },
  });
  if (existing) return existing.householdId;

  const householdName = `${userName.split(" ")[0]}'s kitchen`;

  const household = await prisma.household.create({
    data: {
      name: householdName,
      members: {
        create: { userId, role: "OWNER" },
      },
      categories: {
        create: categoryCreateData(),
      },
      mealTypes: {
        create: DEFAULT_MEAL_TYPES.map((m, i) => ({
          name: m.name,
          slug: m.slug,
          sortOrder: i,
          enabled: true,
        })),
      },
      pantryStaples: {
        create: DEFAULT_PANTRY.map((name) => ({ name })),
      },
    },
  });
  return household.id;
}

async function joinInvitedHousehold(userId: string, householdId: string) {
  const existing = await prisma.householdMember.findUnique({
    where: {
      householdId_userId: { householdId, userId },
    },
  });
  if (!existing) {
    await prisma.householdMember.create({
      data: {
        householdId,
        userId,
        role: "MEMBER",
      },
    });
  }
}

const trustedOrigins = originList(
  process.env.BETTER_AUTH_URL,
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.BETTER_AUTH_TRUSTED_ORIGINS,
);

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {},
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;
      const email = String(ctx.body?.email || "");
      const inviteCode = String(
        (ctx.body as { inviteCode?: string } | undefined)?.inviteCode || "",
      );
      try {
        await gateSignUp({ email, inviteCode });
      } catch (e) {
        throw new APIError("BAD_REQUEST", {
          message:
            e instanceof Error
              ? e.message
              : "Signup is invite-only",
        });
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const invitedTo = takePendingInviteHousehold(user.email);
          if (invitedTo) {
            await joinInvitedHousehold(user.id, invitedTo);
            return;
          }
          await bootstrapHousehold(user.id, user.name || "Family");
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
