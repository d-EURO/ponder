import { pool, withTransaction } from '../database/client';

export interface TaskCompletion {
  task_id: number;
  tx_hash: string;
  completed_at: string;
  amount_swapped?: string;
}

export interface CampaignProgress {
  wallet_address: string;
  chain_id: number;
  created_at: string;
  updated_at: string;
}

// Get campaign progress for a wallet
export async function getProgressForWallet(
  walletAddress: string,
  chainId: number
): Promise<TaskCompletion[]> {
  try {
    // First, ensure user exists in campaign_progress
    await pool.query(
      `INSERT INTO campaign_progress (wallet_address, chain_id)
       VALUES ($1, $2)
       ON CONFLICT (wallet_address, chain_id) DO NOTHING`,
      [walletAddress.toLowerCase(), chainId]
    );

    // Get completed tasks
    const result = await pool.query(
      `SELECT task_id, tx_hash, completed_at, amount_swapped
       FROM task_completions
       WHERE wallet_address = $1 AND chain_id = $2
       ORDER BY task_id`,
      [walletAddress.toLowerCase(), chainId]
    );

    return result.rows;
  } catch (error) {
    console.error('Error getting progress for wallet:', error);
    throw error;
  }
}

// Save task completion
export async function saveTaskCompletion(
  walletAddress: string,
  taskId: number,
  txHash: string,
  chainId: number,
  timestamp: string,
  amountSwapped?: string
): Promise<void> {
  await withTransaction(async (client) => {
    // Ensure user exists in campaign_progress
    await client.query(
      `INSERT INTO campaign_progress (wallet_address, chain_id)
       VALUES ($1, $2)
       ON CONFLICT (wallet_address, chain_id)
       DO UPDATE SET updated_at = NOW()`,
      [walletAddress.toLowerCase(), chainId]
    );

    // Save task completion
    await client.query(
      `INSERT INTO task_completions
       (wallet_address, task_id, tx_hash, completed_at, chain_id, amount_swapped)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        walletAddress.toLowerCase(),
        taskId,
        txHash.toLowerCase(),
        timestamp,
        chainId,
        amountSwapped || null
      ]
    );
  });
}

// Check if task is already completed
export async function isTaskCompleted(
  walletAddress: string,
  taskId: number,
  chainId: number
): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM task_completions
     WHERE wallet_address = $1 AND task_id = $2 AND chain_id = $3`,
    [walletAddress.toLowerCase(), taskId, chainId]
  );

  return result.rowCount > 0;
}

// Check if transaction hash is already used
export async function isTransactionUsed(txHash: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM task_completions WHERE tx_hash = $1`,
    [txHash.toLowerCase()]
  );

  return result.rowCount > 0;
}

// Get campaign statistics
export async function getCampaignStats(): Promise<any> {
  const result = await pool.query('SELECT * FROM campaign_stats');
  return result.rows[0] || {
    total_participants: 0,
    total_completed_tasks: 0,
    task_1_completions: 0,
    task_2_completions: 0,
    task_3_completions: 0,
    fully_completed_campaigns: 0
  };
}

// Get leaderboard
export async function getLeaderboard(limit: number = 100): Promise<any[]> {
  const result = await pool.query(
    `SELECT
       cp.wallet_address,
       COUNT(tc.id) as completed_tasks,
       MIN(tc.completed_at) as first_completion,
       MAX(tc.completed_at) as last_completion,
       CASE
         WHEN COUNT(tc.id) = 3 THEN MAX(tc.completed_at)
         ELSE NULL
       END as campaign_completed_at
     FROM campaign_progress cp
     LEFT JOIN task_completions tc ON cp.wallet_address = tc.wallet_address AND cp.chain_id = tc.chain_id
     WHERE cp.chain_id = 5115
     GROUP BY cp.wallet_address
     HAVING COUNT(tc.id) > 0
     ORDER BY completed_tasks DESC, campaign_completed_at ASC
     LIMIT $1`,
    [limit]
  );

  return result.rows;
}

// Cache transaction data
export async function cacheTransaction(
  txHash: string,
  chainId: number,
  transactionData: any
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO transaction_cache
       (tx_hash, chain_id, from_address, to_address, input_token, output_token,
        amount_in, amount_out, block_number, timestamp, method_signature, raw_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (tx_hash) DO UPDATE
       SET expires_at = NOW() + INTERVAL '5 minutes'`,
      [
        txHash.toLowerCase(),
        chainId,
        transactionData.from_address,
        transactionData.to_address,
        transactionData.input_token,
        transactionData.output_token,
        transactionData.amount_in,
        transactionData.amount_out,
        transactionData.block_number,
        transactionData.timestamp,
        transactionData.method_signature,
        JSON.stringify(transactionData.raw_data)
      ]
    );
  } catch (error) {
    console.error('Error caching transaction:', error);
    // Don't throw - caching is optional
  }
}

// Get cached transaction
export async function getCachedTransaction(txHash: string): Promise<any | null> {
  try {
    const result = await pool.query(
      `SELECT * FROM transaction_cache
       WHERE tx_hash = $1 AND expires_at > NOW()`,
      [txHash.toLowerCase()]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting cached transaction:', error);
    return null;
  }
}