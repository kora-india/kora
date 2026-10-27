-- Plans the super admin can edit (U1). No rows means the code defaults apply.
CREATE TABLE "plan_configs" (
    "plan" "SubscriptionPlan" NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "monthlyPriceInr" INTEGER NOT NULL,
    "maxStudents" INTEGER,
    "maxTeachers" INTEGER,
    "maxClasses" INTEGER,
    "modules" TEXT[],
    "benefits" TEXT[],
    "popular" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_configs_pkey" PRIMARY KEY ("plan")
);
