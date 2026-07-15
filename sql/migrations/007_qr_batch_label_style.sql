-- =======================================================
-- QR batch label style (shape + color for PDF stickers)
-- =======================================================

ALTER TABLE qr_batches
  ADD COLUMN IF NOT EXISTS label_shape VARCHAR(20) NOT NULL DEFAULT 'cap';

ALTER TABLE qr_batches
  ADD COLUMN IF NOT EXISTS label_color VARCHAR(40) NOT NULL DEFAULT 'performance_green';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'qr_batches_label_shape_check'
  ) THEN
    ALTER TABLE qr_batches
      ADD CONSTRAINT qr_batches_label_shape_check
      CHECK (label_shape IN ('cap', 'square'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'qr_batches_label_color_check'
  ) THEN
    ALTER TABLE qr_batches
      ADD CONSTRAINT qr_batches_label_color_check
      CHECK (
        label_color IN (
          'performance_green',
          'heavy_duty_blue',
          'industrial_bronze',
          'premium_gold',
          'professional_graphite',
          'signature_burgundy'
        )
      );
  END IF;
END $$;
