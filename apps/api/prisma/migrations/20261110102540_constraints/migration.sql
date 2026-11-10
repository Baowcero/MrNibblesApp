-- Run after the first Prisma migration (add as a custom migration).
-- These rules cannot be written in schema.prisma.

-- Money and quantity checks
ALTER TABLE order_items ADD CONSTRAINT order_items_qty_pos CHECK (quantity > 0);
ALTER TABLE order_items ADD CONSTRAINT order_items_line_total CHECK (line_total_kobo = quantity * unit_price_kobo);
ALTER TABLE orders ADD CONSTRAINT orders_money_nonneg CHECK (subtotal_kobo >= 0 AND paystack_fee_kobo >= 0 AND total_kobo >= 0 AND savings_kobo >= 0);
ALTER TABLE orders ADD CONSTRAINT orders_total_matches CHECK (total_kobo = subtotal_kobo + paystack_fee_kobo);
ALTER TABLE payments ADD CONSTRAINT payments_money_nonneg CHECK (amount_kobo >= 0 AND fee_kobo >= 0);
ALTER TABLE product_prices ADD CONSTRAINT product_prices_pos CHECK (unit_price_kobo > 0);
ALTER TABLE production_run_outputs ADD CONSTRAINT run_output_qty_pos CHECK (quantity > 0);
ALTER TABLE bread_stock_movements ADD CONSTRAINT bread_qty_pos CHECK (quantity > 0);

-- Append-only ledgers: block UPDATE and DELETE
CREATE OR REPLACE FUNCTION forbid_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_ledger_append_only BEFORE UPDATE OR DELETE ON payment_ledger
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER savings_ledger_append_only BEFORE UPDATE OR DELETE ON savings_ledger
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER raw_material_movements_append_only BEFORE UPDATE OR DELETE ON raw_material_movements
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER bread_stock_movements_append_only BEFORE UPDATE OR DELETE ON bread_stock_movements
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER order_status_history_append_only BEFORE UPDATE OR DELETE ON order_status_history
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION forbid_change();

-- A delivery order cannot become 'delivered' without a delivery photo
CREATE OR REPLACE FUNCTION require_delivery_photo() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' AND NEW.fulfilment = 'delivery' THEN
    IF NOT EXISTS (
      SELECT 1 FROM deliveries d JOIN delivery_photos p ON p.delivery_id = d.id WHERE d.order_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'A delivery photo is required before an order can be marked delivered';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_require_photo BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION require_delivery_photo();

-- One default location per customer
CREATE UNIQUE INDEX customer_default_location ON customer_locations (customer_id) WHERE is_default AND is_active;
