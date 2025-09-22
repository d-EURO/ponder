import { Request, Response } from 'express';
import { getProgressForWallet, saveTaskCompletion } from '../services/databaseService';
import { validateSwapTransaction } from '../services/blockchainService';
import { enhancedSwapValidator } from '../services/enhancedSwapValidator';

// Task definitions
const TASKS = [
  {
    id: 1,
    name: "Swap cBTC to NUSD",
    description: "Complete a swap from cBTC to NUSD",
    outputToken: "0x9B28B690550522608890C3C7e63c0b4A7eBab9AA"
  },
  {
    id: 2,
    name: "Swap cBTC to cUSD",
    description: "Complete a swap from cBTC to cUSD",
    outputToken: "0x2fFC18aC99D367b70dd922771dF8c2074af4aCE0"
  },
  {
    id: 3,
    name: "Swap cBTC to USDC",
    description: "Complete a swap from cBTC to USDC",
    outputToken: "0x36c16eaC6B0Ba6c50f494914ff015fCa95B7835F"
  }
];

export async function getCampaignProgress(req: Request, res: Response) {
  try {
    const { walletAddress, chainId } = req.body;

    // Get user's completed tasks from database
    const completedTasks = await getProgressForWallet(walletAddress, chainId);

    // Build response with all tasks and their status
    const tasks = TASKS.map(task => {
      const completed = completedTasks.find(t => t.task_id === task.id);
      return {
        id: task.id,
        name: task.name,
        description: task.description,
        completed: !!completed,
        completedAt: completed?.completed_at || null,
        txHash: completed?.tx_hash || null
      };
    });

    const completedCount = tasks.filter(t => t.completed).length;

    res.json({
      walletAddress,
      chainId,
      tasks,
      totalTasks: TASKS.length,
      completedTasks: completedCount,
      progress: (completedCount / TASKS.length) * 100,
      nftClaimed: false, // TODO: Implement NFT claim tracking
      claimTxHash: null
    });
  } catch (error) {
    console.error('Error getting campaign progress:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
}

export async function completeTask(req: Request, res: Response) {
  try {
    const { walletAddress, taskId, txHash, chainId, timestamp } = req.body;

    // Check if task already completed
    const progress = await getProgressForWallet(walletAddress, chainId);
    if (progress.find(t => t.task_id === taskId)) {
      return res.status(400).json({
        error: 'Task already completed',
        code: 'TASK_ALREADY_COMPLETED',
        taskId
      });
    }

    // Validate transaction matches task requirements
    const validation = await validateSwapTransaction(txHash, walletAddress, chainId);

    if (!validation.isValid) {
      return res.status(404).json({
        error: 'Transaction does not match task requirements',
        code: 'INVALID_TRANSACTION',
        details: validation.details
      });
    }

    // Check if transaction matches the specified task
    const task = TASKS.find(t => t.id === taskId);
    if (validation.outputToken?.toLowerCase() !== task?.outputToken.toLowerCase()) {
      return res.status(400).json({
        error: 'Transaction output token does not match task',
        code: 'WRONG_TASK',
        details: {
          expected: task?.outputToken,
          found: validation.outputToken
        }
      });
    }

    // Save completion to database
    await saveTaskCompletion(walletAddress, taskId, txHash, chainId, timestamp);

    // Get updated progress
    const updatedProgress = await getProgressForWallet(walletAddress, chainId);
    const completedCount = updatedProgress.length;

    res.json({
      success: true,
      message: 'Task completed successfully',
      taskId,
      walletAddress,
      updatedProgress: {
        completedTasks: completedCount,
        totalTasks: TASKS.length,
        progress: (completedCount / TASKS.length) * 100
      }
    });
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
}

export async function checkSwapTransaction(req: Request, res: Response) {
  try {
    const { txHash, walletAddress, chainId } = req.body;

    console.log(`📨 Checking swap transaction: ${txHash}`);
    console.log(`   Wallet: ${walletAddress}`);
    console.log(`   Chain: ${chainId}`);

    // Use enhanced validator with confirmation waiting
    const validation = await enhancedSwapValidator.validateSwapWithConfirmation(
      txHash,
      walletAddress,
      chainId,
      {
        requiredConfirmations: 1, // Wait for at least 1 confirmation
        maxRetries: 20, // Try up to 20 times
        retryDelay: 3000, // 3 seconds between retries
        timeout: 60000, // 60 seconds total timeout
      }
    );

    // Return status information immediately if still pending
    if (validation.status === 'pending') {
      return res.json({
        taskId: null,
        status: 'pending',
        isValid: false,
        reason: 'Transaction is still pending confirmation',
        message: 'Please check again in a few seconds',
      });
    }

    // Return not found status if transaction doesn't exist
    if (validation.status === 'not_found') {
      return res.json({
        taskId: null,
        status: 'not_found',
        isValid: false,
        reason: 'Transaction not found on chain',
        message: 'Transaction may not be submitted yet or invalid hash',
      });
    }

    // Return failed status if transaction failed
    if (validation.status === 'failed') {
      return res.json({
        taskId: null,
        status: 'failed',
        isValid: false,
        reason: validation.reason || 'Transaction failed',
        message: 'The transaction was reverted or failed',
      });
    }

    // Transaction is confirmed - check validation
    if (!validation.isValid) {
      return res.json({
        taskId: null,
        status: 'confirmed',
        isValid: false,
        reason: validation.reason || 'Swap does not match any campaign tasks',
        warnings: validation.warnings,
      });
    }

    // Find matching task
    const matchingTask = TASKS.find(
      t => t.outputToken.toLowerCase() === validation.outputToken?.toLowerCase()
    );

    if (!matchingTask) {
      return res.json({
        taskId: null,
        status: 'confirmed',
        isValid: false,
        reason: 'Swap does not match any campaign tasks',
        details: {
          outputToken: validation.outputToken,
          expectedTokens: TASKS.map(t => ({ id: t.id, name: t.name, token: t.outputToken }))
        }
      });
    }

    // Success! Task matches
    console.log(`✅ Task ${matchingTask.id} (${matchingTask.name}) validated!`);

    res.json({
      taskId: matchingTask.id,
      taskName: matchingTask.name,
      status: 'confirmed',
      isValid: true,
      confirmations: validation.confirmations,
      details: {
        inputToken: validation.inputToken,
        outputToken: matchingTask.name.split(' to ')[1],
        outputAddress: validation.outputToken,
        amount: validation.outputAmount,
        timestamp: validation.timestamp,
        blockNumber: validation.blockNumber?.toString(),
        transactionIndex: validation.transactionIndex,
      }
    });
  } catch (error) {
    console.error('Error checking swap transaction:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
      status: 'error'
    });
  }
}