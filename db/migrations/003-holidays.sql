-- Holiday pricing, set by each host per listing (decision 0003). Dates, percentage and refund days are set together or not at all.
ALTER TABLE listings ADD COLUMN holiday_dates TEXT NOT NULL DEFAULT '[]';
ALTER TABLE listings ADD COLUMN holiday_surcharge_pct INTEGER CHECK(holiday_surcharge_pct IS NULL OR holiday_surcharge_pct BETWEEN 1 AND 50);
ALTER TABLE listings ADD COLUMN holiday_refund_days INTEGER CHECK(holiday_refund_days IS NULL OR holiday_refund_days BETWEEN 1 AND 60);
-- Saved on the reservation when it is made, so later host edits and rule changes never reach it.
-- Reservations made before this migration keep NULL here and the refund rules they were made under.
ALTER TABLE bookings ADD COLUMN surcharge_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN holiday_refund_days INTEGER;
ALTER TABLE bookings ADD COLUMN free_cancel_until TEXT;
