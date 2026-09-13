-- AlterTable
ALTER TABLE "ShoppingList" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "weekStart" DATE;

-- CreateIndex
CREATE INDEX "ShoppingList_householdId_weekStart_idx" ON "ShoppingList"("householdId", "weekStart");
