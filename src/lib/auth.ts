import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./prisma";
import { categoryCreateData } from "./categories";

const DEFAULT_MEAL_TYPES = [{ name: "Evening main", slug: "evening-main" }];

const DEFAULT_PANTRY = [
  "salt",
  "pepper",
  "olive oil",
  "vegetable oil",
  "butter",
  "garlic",
];

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

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter((v): v is string => Boolean(v)),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {},
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await bootstrapHousehold(user.id, user.name || "Family");
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
