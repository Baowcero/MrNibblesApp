-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "read_at" TIMESTAMPTZ,
ADD COLUMN "target" TEXT;

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");
