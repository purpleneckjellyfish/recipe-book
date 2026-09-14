-- CreateTable
CREATE TABLE "ToTryItem" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToTryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ToTryItem_householdId_createdAt_idx" ON "ToTryItem"("householdId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ToTryItem_householdId_recipeId_key" ON "ToTryItem"("householdId", "recipeId");

-- AddForeignKey
ALTER TABLE "ToTryItem" ADD CONSTRAINT "ToTryItem_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToTryItem" ADD CONSTRAINT "ToTryItem_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
