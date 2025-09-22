-- bApps Campaign Database Schema
-- PostgreSQL schema for tracking user progress in Citrea bApps Campaign

-- User progress table
CREATE TABLE IF NOT EXISTS campaign_progress (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL,
  chain_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(wallet_address, chain_id)
);

-- Task completions table
CREATE TABLE IF NOT EXISTS task_completions (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL,
  task_id INTEGER NOT NULL CHECK (task_id IN (1, 2, 3)),
  tx_hash VARCHAR(66) NOT NULL UNIQUE,
  completed_at TIMESTAMP NOT NULL,
  chain_id INTEGER NOT NULL,
  amount_swapped DECIMAL(36, 18), -- Optional: track swap amounts
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(wallet_address, task_id, chain_id)
);

-- Transaction cache for performance
CREATE TABLE IF NOT EXISTS transaction_cache (
  tx_hash VARCHAR(66) PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  from_address VARCHAR(42),
  to_address VARCHAR(42),
  input_token VARCHAR(42),
  output_token VARCHAR(42),
  amount_in DECIMAL(36, 18),
  amount_out DECIMAL(36, 18),
  block_number BIGINT,
  timestamp TIMESTAMP,
  method_signature VARCHAR(10),
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '5 minutes')
);

-- NFT claim tracking (for future use)
CREATE TABLE IF NOT EXISTS nft_claims (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL,
  chain_id INTEGER NOT NULL,
  claim_tx_hash VARCHAR(66) UNIQUE,
  claimed_at TIMESTAMP,
  nft_token_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(wallet_address, chain_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_wallet_chain ON campaign_progress(wallet_address, chain_id);
CREATE INDEX IF NOT EXISTS idx_task_wallet ON task_completions(wallet_address, chain_id);
CREATE INDEX IF NOT EXISTS idx_tx_cache_expires ON transaction_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_task_completions_created ON task_completions(created_at DESC);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_campaign_progress_updated_at BEFORE UPDATE
    ON campaign_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for campaign statistics
CREATE OR REPLACE VIEW campaign_stats AS
SELECT
    COUNT(DISTINCT cp.wallet_address) as total_participants,
    COUNT(tc.id) as total_completed_tasks,
    COUNT(DISTINCT CASE WHEN tc.task_id = 1 THEN cp.wallet_address END) as task_1_completions,
    COUNT(DISTINCT CASE WHEN tc.task_id = 2 THEN cp.wallet_address END) as task_2_completions,
    COUNT(DISTINCT CASE WHEN tc.task_id = 3 THEN cp.wallet_address END) as task_3_completions,
    COUNT(DISTINCT CASE
        WHEN (SELECT COUNT(*) FROM task_completions tc2
              WHERE tc2.wallet_address = cp.wallet_address AND tc2.chain_id = cp.chain_id) = 3
        THEN cp.wallet_address
    END) as fully_completed_campaigns
FROM campaign_progress cp
LEFT JOIN task_completions tc ON cp.wallet_address = tc.wallet_address AND cp.chain_id = tc.chain_id
WHERE cp.chain_id = 5115;