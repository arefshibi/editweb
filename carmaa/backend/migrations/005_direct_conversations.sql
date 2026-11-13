-- Direct conversations are used by replies to personal stories and do not require a listing.
ALTER TABLE conversations ALTER COLUMN listing_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS conversations_direct_pair_unique
  ON conversations (LEAST(buyer_id, seller_id), GREATEST(buyer_id, seller_id))
  WHERE listing_id IS NULL;
