-- CreateTable
CREATE TABLE "PinnedShopItem" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(12,3),
    "unit" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PinnedShopItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PinnedShopItem_householdId_name_key" ON "PinnedShopItem"("householdId", "name");

-- AddForeignKey
ALTER TABLE "PinnedShopItem" ADD CONSTRAINT "PinnedShopItem_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
