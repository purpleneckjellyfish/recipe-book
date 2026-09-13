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

async function bootstrapHousehold(userId: string, userName: string) {
  const householdName = `${userName.split(" ")[0]}'s kitchen`;

  await prisma.household.create({
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
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
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
