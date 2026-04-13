import { SavingsV2ABI, SavingsV3ABI } from '@deuro/eurocoin';
import { ADDR, V3_START_BLOCK } from '../../ponder.config';
import { zeroAddress } from 'viem';
import { ponder } from 'ponder:registry';

type Client = Parameters<Parameters<typeof ponder.on>[1]>[0]['context']['client'];

/** Read the combined amountSaved for an account across V2 and V3 Savings contracts. */
export async function readCombinedAmountSaved(client: Client, account: `0x${string}`, blockNumber: bigint): Promise<bigint> {
	const v3Available = ADDR.savings && ADDR.savings !== zeroAddress && blockNumber >= BigInt(V3_START_BLOCK);
	const [v2Result, v3Result] = await Promise.all([
		client.readContract({
			abi: SavingsV2ABI,
			address: ADDR.savingsGateway,
			functionName: 'savings',
			args: [account],
		}),
		v3Available
			? client.readContract({
					abi: SavingsV3ABI,
					address: ADDR.savings,
					functionName: 'savings',
					args: [account],
				})
			: Promise.resolve([0n] as const),
	]);
	return v2Result[0] + v3Result[0];
}
