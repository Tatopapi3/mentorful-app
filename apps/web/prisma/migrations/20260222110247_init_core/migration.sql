-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TEACHER');

-- CreateEnum
CREATE TYPE "Domain" AS ENUM ('CLASSROOM', 'PLANNING', 'COMMUNICATION', 'ASSESSMENT');

-- CreateEnum
CREATE TYPE "PairingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VisitRecordStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "department" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cycle" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "strategicPriority" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pairing" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "domain" "Domain" NOT NULL,
    "strategicTag" TEXT NOT NULL,
    "status" "PairingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "Pairing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitRecord" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "pairingId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "domain" "Domain" NOT NULL,
    "strategicTag" TEXT NOT NULL,
    "visionText" TEXT,
    "strengthsText" TEXT,
    "moreText" TEXT,
    "lessText" TEXT,
    "supportText" TEXT,
    "strengthTags" JSONB,
    "status" "VisitRecordStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_clerkUserId_key" ON "UserProfile"("clerkUserId");

-- CreateIndex
CREATE INDEX "UserProfile_schoolId_idx" ON "UserProfile"("schoolId");

-- CreateIndex
CREATE INDEX "Cycle_schoolId_idx" ON "Cycle"("schoolId");

-- CreateIndex
CREATE INDEX "Pairing_schoolId_idx" ON "Pairing"("schoolId");

-- CreateIndex
CREATE INDEX "Pairing_cycleId_idx" ON "Pairing"("cycleId");

-- CreateIndex
CREATE INDEX "Pairing_hostId_idx" ON "Pairing"("hostId");

-- CreateIndex
CREATE INDEX "Pairing_visitorId_idx" ON "Pairing"("visitorId");

-- CreateIndex
CREATE UNIQUE INDEX "Pairing_cycleId_hostId_visitorId_key" ON "Pairing"("cycleId", "hostId", "visitorId");

-- CreateIndex
CREATE UNIQUE INDEX "VisitRecord_pairingId_key" ON "VisitRecord"("pairingId");

-- CreateIndex
CREATE INDEX "VisitRecord_schoolId_idx" ON "VisitRecord"("schoolId");

-- CreateIndex
CREATE INDEX "VisitRecord_cycleId_idx" ON "VisitRecord"("cycleId");

-- CreateIndex
CREATE INDEX "VisitRecord_hostId_idx" ON "VisitRecord"("hostId");

-- CreateIndex
CREATE INDEX "VisitRecord_visitorId_idx" ON "VisitRecord"("visitorId");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cycle" ADD CONSTRAINT "Cycle_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pairing" ADD CONSTRAINT "Pairing_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pairing" ADD CONSTRAINT "Pairing_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pairing" ADD CONSTRAINT "Pairing_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pairing" ADD CONSTRAINT "Pairing_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitRecord" ADD CONSTRAINT "VisitRecord_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitRecord" ADD CONSTRAINT "VisitRecord_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitRecord" ADD CONSTRAINT "VisitRecord_pairingId_fkey" FOREIGN KEY ("pairingId") REFERENCES "Pairing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitRecord" ADD CONSTRAINT "VisitRecord_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitRecord" ADD CONSTRAINT "VisitRecord_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
