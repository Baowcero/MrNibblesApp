-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('customer', 'distributor', 'ceo', 'sales', 'accounts', 'production', 'store_keeper');

-- CreateEnum
CREATE TYPE "customer_status" AS ENUM ('unclaimed', 'pending_approval', 'active', 'rejected', 'suspended');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('ios', 'android');

-- CreateEnum
CREATE TYPE "Fulfilment" AS ENUM ('delivery', 'pickup');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('placed', 'paid', 'assigned', 'out_for_delivery', 'delivered', 'ready', 'collected', 'delivery_failed');

-- CreateEnum
CREATE TYPE "FailureReason" AS ENUM ('customer_not_available', 'shop_closed', 'address_not_found', 'other');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('paystack', 'office_cash');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "PaymentLedgerType" AS ENUM ('charge', 'fee', 'reversal');

-- CreateEnum
CREATE TYPE "SavingsEntryType" AS ENUM ('earned', 'adjustment', 'reversal');

-- CreateEnum
CREATE TYPE "RunType" AS ENUM ('morning', 'night');

-- CreateEnum
CREATE TYPE "RawMaterialMovementType" AS ENUM ('received', 'used_in_run', 'adjustment');

-- CreateEnum
CREATE TYPE "BreadMovementType" AS ENUM ('produced', 'delivered', 'returned', 'leftover_to_sales');

-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('missing', 'damaged', 'wrong_quantity', 'other');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('open', 'settled');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "ReconciliationItemType" AS ENUM ('issue', 'return', 'payment_mismatch');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('booking_reminder', 'order_status', 'issue_update');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('queued', 'sent', 'failed');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" "RoleCode" NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "business_name" TEXT NOT NULL,
    "status" "customer_status" NOT NULL DEFAULT 'unclaimed',
    "source" TEXT NOT NULL DEFAULT 'signup',
    "claimed_at" TIMESTAMPTZ,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ,
    "rejection_note" TEXT,
    "created_by" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_locations" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "area_id" UUID NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "customer_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distributors" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "distributors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "platform" "Platform" NOT NULL,
    "push_token" TEXT NOT NULL,
    "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" UUID,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_prices" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "unit_price_kobo" BIGINT NOT NULL,
    "effective_from" TIMESTAMPTZ NOT NULL,
    "effective_to" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_settings" (
    "id" UUID NOT NULL,
    "cutoff_time" TEXT NOT NULL DEFAULT '08:30',
    "delivery_start" TEXT NOT NULL DEFAULT '09:00',
    "delivery_end" TEXT NOT NULL DEFAULT '16:00',
    "saturday_cutoff_day" TEXT NOT NULL DEFAULT 'friday',
    "effective_from" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "order_no" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "location_id" UUID,
    "fulfilment" "Fulfilment" NOT NULL,
    "delivery_date" DATE NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'placed',
    "subtotal_kobo" BIGINT NOT NULL,
    "paystack_fee_kobo" BIGINT NOT NULL DEFAULT 0,
    "total_kobo" BIGINT NOT NULL,
    "savings_kobo" BIGINT NOT NULL DEFAULT 0,
    "placed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_kobo" BIGINT NOT NULL,
    "line_total_kobo" BIGINT NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "from_status" "OrderStatus",
    "to_status" "OrderStatus" NOT NULL,
    "changed_by" UUID,
    "changed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "distributor_id" UUID NOT NULL,
    "assigned_by" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ,
    "delivered_at" TIMESTAMPTZ,
    "failed_reason" "FailureReason",
    "failure_note" TEXT,
    "client_event_id" TEXT,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_photos" (
    "id" UUID NOT NULL,
    "delivery_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "taken_at" TIMESTAMPTZ NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "amount_kobo" BIGINT NOT NULL,
    "fee_kobo" BIGINT NOT NULL DEFAULT 0,
    "paystack_reference" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "recorded_by" UUID,
    "paid_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paystack_events" (
    "id" UUID NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signature_valid" BOOLEAN NOT NULL,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ,
    "error" TEXT,

    CONSTRAINT "paystack_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_receipts" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "received_by" UUID NOT NULL,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "cash_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_ledger" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "entry_type" "PaymentLedgerType" NOT NULL,
    "amount_kobo" BIGINT NOT NULL,
    "balance_after_kobo" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "savings_ledger" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "order_id" UUID,
    "entry_type" "SavingsEntryType" NOT NULL,
    "amount_kobo" BIGINT NOT NULL,
    "balance_after_kobo" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "savings_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_runs" (
    "id" UUID NOT NULL,
    "run_date" DATE NOT NULL,
    "run_type" "RunType" NOT NULL,
    "recorded_by" UUID NOT NULL,
    "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "production_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_run_outputs" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "production_run_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_materials" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "reorder_level" DECIMAL(12,3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "raw_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_material_movements" (
    "id" UUID NOT NULL,
    "raw_material_id" UUID NOT NULL,
    "movement_type" "RawMaterialMovementType" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "run_id" UUID,
    "recorded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_material_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_stock_counts" (
    "id" UUID NOT NULL,
    "count_date" DATE NOT NULL,
    "raw_material_id" UUID NOT NULL,
    "counted_quantity" DECIMAL(12,3) NOT NULL,
    "expected_quantity" DECIMAL(12,3) NOT NULL,
    "variance" DECIMAL(12,3) NOT NULL,
    "counted_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_stock_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bread_stock_movements" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "movement_type" "BreadMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "order_id" UUID,
    "run_id" UUID,
    "recorded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bread_stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_issues" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "delivery_id" UUID,
    "reported_by" UUID NOT NULL,
    "reporter_role" "RoleCode" NOT NULL,
    "issue_type" "IssueType" NOT NULL,
    "quantity" INTEGER,
    "note" TEXT,
    "status" "IssueStatus" NOT NULL DEFAULT 'open',
    "settled_in" UUID,
    "settled_by" UUID,
    "settled_at" TIMESTAMPTZ,
    "client_event_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_issue_photos" (
    "id" UUID NOT NULL,
    "issue_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,

    CONSTRAINT "order_issue_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_reconciliations" (
    "id" UUID NOT NULL,
    "recon_date" DATE NOT NULL,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'open',
    "opened_by" UUID NOT NULL,
    "closed_by" UUID,
    "closed_at" TIMESTAMPTZ,
    "note" TEXT,

    CONSTRAINT "daily_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_items" (
    "id" UUID NOT NULL,
    "reconciliation_id" UUID NOT NULL,
    "order_id" UUID,
    "issue_id" UUID,
    "item_type" "ReconciliationItemType" NOT NULL,
    "amount_kobo" BIGINT,
    "quantity" INTEGER,
    "resolution" TEXT,
    "note" TEXT,

    CONSTRAINT "reconciliation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "scheduled_for" TIMESTAMPTZ,
    "sent_at" TIMESTAMPTZ,
    "status" "NotificationStatus" NOT NULL DEFAULT 'queued',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_schedules" (
    "id" UUID NOT NULL,
    "delivery_date" DATE NOT NULL,
    "remind_at" TIMESTAMPTZ NOT NULL,
    "label" TEXT NOT NULL,
    "enqueued_at" TIMESTAMPTZ,

    CONSTRAINT "reminder_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "customers_user_id_key" ON "customers"("user_id");

-- CreateIndex
CREATE INDEX "customers_status_idx" ON "customers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "areas_name_key" ON "areas"("name");

-- CreateIndex
CREATE INDEX "customer_locations_customer_id_idx" ON "customer_locations"("customer_id");

-- CreateIndex
CREATE INDEX "customer_locations_area_id_idx" ON "customer_locations"("area_id");

-- CreateIndex
CREATE UNIQUE INDEX "distributors_user_id_key" ON "distributors"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "devices_push_token_key" ON "devices"("push_token");

-- CreateIndex
CREATE INDEX "devices_user_id_idx" ON "devices"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_code_key" ON "products"("code");

-- CreateIndex
CREATE INDEX "product_prices_product_id_effective_from_idx" ON "product_prices"("product_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_no_key" ON "orders"("order_no");

-- CreateIndex
CREATE INDEX "orders_customer_id_delivery_date_idx" ON "orders"("customer_id", "delivery_date");

-- CreateIndex
CREATE INDEX "orders_status_delivery_date_idx" ON "orders"("status", "delivery_date");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_changed_at_idx" ON "order_status_history"("order_id", "changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_order_id_key" ON "deliveries"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_client_event_id_key" ON "deliveries"("client_event_id");

-- CreateIndex
CREATE INDEX "deliveries_distributor_id_delivered_at_idx" ON "deliveries"("distributor_id", "delivered_at");

-- CreateIndex
CREATE INDEX "delivery_photos_delivery_id_idx" ON "delivery_photos"("delivery_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_paystack_reference_key" ON "payments"("paystack_reference");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "paystack_events_event_id_key" ON "paystack_events"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_receipts_payment_id_key" ON "cash_receipts"("payment_id");

-- CreateIndex
CREATE INDEX "payment_ledger_order_id_idx" ON "payment_ledger"("order_id");

-- CreateIndex
CREATE INDEX "savings_ledger_customer_id_created_at_idx" ON "savings_ledger"("customer_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "production_runs_run_date_run_type_key" ON "production_runs"("run_date", "run_type");

-- CreateIndex
CREATE UNIQUE INDEX "production_run_outputs_run_id_product_id_key" ON "production_run_outputs"("run_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "raw_materials_name_key" ON "raw_materials"("name");

-- CreateIndex
CREATE INDEX "raw_material_movements_raw_material_id_created_at_idx" ON "raw_material_movements"("raw_material_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "daily_stock_counts_count_date_raw_material_id_key" ON "daily_stock_counts"("count_date", "raw_material_id");

-- CreateIndex
CREATE INDEX "bread_stock_movements_product_id_created_at_idx" ON "bread_stock_movements"("product_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "order_issues_client_event_id_key" ON "order_issues"("client_event_id");

-- CreateIndex
CREATE INDEX "order_issues_status_created_at_idx" ON "order_issues"("status", "created_at");

-- CreateIndex
CREATE INDEX "order_issues_order_id_idx" ON "order_issues"("order_id");

-- CreateIndex
CREATE INDEX "order_issue_photos_issue_id_idx" ON "order_issue_photos"("issue_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_reconciliations_recon_date_key" ON "daily_reconciliations"("recon_date");

-- CreateIndex
CREATE INDEX "reconciliation_items_reconciliation_id_idx" ON "reconciliation_items"("reconciliation_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_schedules_delivery_date_label_key" ON "reminder_schedules"("delivery_date", "label");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_locations" ADD CONSTRAINT "customer_locations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_locations" ADD CONSTRAINT "customer_locations_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributors" ADD CONSTRAINT "distributors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "customer_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "distributors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_photos" ADD CONSTRAINT "delivery_photos_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_receipts" ADD CONSTRAINT "cash_receipts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_receipts" ADD CONSTRAINT "cash_receipts_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_ledger" ADD CONSTRAINT "payment_ledger_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_ledger" ADD CONSTRAINT "payment_ledger_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_ledger" ADD CONSTRAINT "savings_ledger_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_ledger" ADD CONSTRAINT "savings_ledger_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_run_outputs" ADD CONSTRAINT "production_run_outputs_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "production_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_run_outputs" ADD CONSTRAINT "production_run_outputs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_material_movements" ADD CONSTRAINT "raw_material_movements_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_material_movements" ADD CONSTRAINT "raw_material_movements_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "production_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_material_movements" ADD CONSTRAINT "raw_material_movements_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_stock_counts" ADD CONSTRAINT "daily_stock_counts_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_stock_counts" ADD CONSTRAINT "daily_stock_counts_counted_by_fkey" FOREIGN KEY ("counted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bread_stock_movements" ADD CONSTRAINT "bread_stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bread_stock_movements" ADD CONSTRAINT "bread_stock_movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bread_stock_movements" ADD CONSTRAINT "bread_stock_movements_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "production_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bread_stock_movements" ADD CONSTRAINT "bread_stock_movements_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_issues" ADD CONSTRAINT "order_issues_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_issues" ADD CONSTRAINT "order_issues_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_issues" ADD CONSTRAINT "order_issues_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_issues" ADD CONSTRAINT "order_issues_settled_by_fkey" FOREIGN KEY ("settled_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_issues" ADD CONSTRAINT "order_issues_settled_in_fkey" FOREIGN KEY ("settled_in") REFERENCES "daily_reconciliations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_issue_photos" ADD CONSTRAINT "order_issue_photos_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "order_issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_reconciliations" ADD CONSTRAINT "daily_reconciliations_opened_by_fkey" FOREIGN KEY ("opened_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_reconciliations" ADD CONSTRAINT "daily_reconciliations_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_items" ADD CONSTRAINT "reconciliation_items_reconciliation_id_fkey" FOREIGN KEY ("reconciliation_id") REFERENCES "daily_reconciliations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_items" ADD CONSTRAINT "reconciliation_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_items" ADD CONSTRAINT "reconciliation_items_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "order_issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
