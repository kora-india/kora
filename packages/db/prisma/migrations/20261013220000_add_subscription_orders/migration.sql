-- CreateTable
CREATE TABLE "subscription_orders" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentId" TEXT,
    "schoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_orders_orderId_key" ON "subscription_orders"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_orders_paymentId_key" ON "subscription_orders"("paymentId");

-- CreateIndex
CREATE INDEX "subscription_orders_userId_idx" ON "subscription_orders"("userId");

-- CreateIndex
CREATE INDEX "subscription_orders_orderId_idx" ON "subscription_orders"("orderId");
