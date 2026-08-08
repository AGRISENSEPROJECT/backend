-- Migration 010: Allow 0–100 confidence scores on recommendations
-- DECIMAL(5,4) maxes at 9.9999 and rejects model percentages like 60.

ALTER TABLE recommendations
  ALTER COLUMN "confidenceScore" TYPE DECIMAL(5,2);
