import { ERC20ABI, SavingsV2ABI, SavingsV3ABI, SavingsVaultDEUROABI } from '@deuro/eurocoin';
import { ADDR, V2_VAULT_START_BLOCK, V3_START_BLOCK } from '../../ponder.config';
import { Address, zeroAddress } from 'viem';
import { ponder } from 'ponder:registry';
import { savingsStats, savingsTotalHistory, savingsUserLeaderboard } from '../../ponder.schema';

type Client = Parameters<Parameters<typeof ponder.on>[1]>[0]['context']['client'];
type Db = Parameters<Parameters<typeof ponder.on>[1]>[0]['context']['db'];

const isDeployed = (address: string | undefined): address is Address => !!address && address !== zeroAddress;

const SAVINGS_VAULT_ADDRESSES = new Set(
	[ADDR.savingsVaultV2, ADDR.savingsVaultV3].filter(isDeployed).map((address) => address.toLowerCase())
);

export function normalizeSavingsAccount(account: `0x${string}`): Address {
	return account.toLowerCase() as Address;
}

export function isSavingsVaultAccount(account: `0x${string}`): boolean {
	return SAVINGS_VAULT_ADDRESSES.has(account.toLowerCase());
}

async function readVaultAssets(client: Client, vaultAddress: Address | undefined, account: `0x${string}`): Promise<bigint> {
	if (!isDeployed(vaultAddress)) return 0n;

	const shares = await client.readContract({
		abi: ERC20ABI,
		address: vaultAddress,
		functionName: 'balanceOf',
		args: [account],
	});

	if (shares === 0n) return 0n;

	return client.readContract({
		abi: SavingsVaultDEUROABI,
		address: vaultAddress,
		functionName: 'convertToAssets',
		args: [shares],
	});
}

/** Read the combined amountSaved for an account across V2 and V3 Savings contracts. */
export async function readCombinedAmountSaved(client: Client, account: `0x${string}`, blockNumber: bigint): Promise<bigint> {
	const v3Available = isDeployed(ADDR.savings) && blockNumber >= BigInt(V3_START_BLOCK);
	const v2VaultAvailable = isDeployed(ADDR.savingsVaultV2) && blockNumber >= BigInt(V2_VAULT_START_BLOCK);
	const v3VaultAvailable = isDeployed(ADDR.savingsVaultV3) && blockNumber >= BigInt(V3_START_BLOCK);
	const [v2Result, v3Result, v2VaultAssets, v3VaultAssets] = await Promise.all([
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
		v2VaultAvailable ? readVaultAssets(client, ADDR.savingsVaultV2, account) : Promise.resolve(0n),
		v3VaultAvailable ? readVaultAssets(client, ADDR.savingsVaultV3, account) : Promise.resolve(0n),
	]);
	return v2Result[0] + v3Result[0] + v2VaultAssets + v3VaultAssets;
}

/** Read the current total savings balance across V2 and V3 savings contracts. */
export async function readTotalSavedAcrossVersions(client: Client): Promise<bigint> {
	const [v2Balance, v3Balance] = await Promise.all([
		client.readContract({
			abi: ERC20ABI,
			address: ADDR.decentralizedEURO,
			functionName: 'balanceOf',
			args: [ADDR.savingsGateway],
		}),
		isDeployed(ADDR.savings)
			? client.readContract({
					abi: ERC20ABI,
					address: ADDR.decentralizedEURO,
					functionName: 'balanceOf',
					args: [ADDR.savings],
				})
			: Promise.resolve(0n),
	]);

	return v2Balance + v3Balance;
}

export async function syncSavingsUserAggregate(
	db: Db,
	client: Client,
	account: `0x${string}`,
	blockNumber: bigint,
	timestamp: bigint
): Promise<void> {
	const normalizedAccount = normalizeSavingsAccount(account);
	if (isSavingsVaultAccount(normalizedAccount)) return;

	const amountSaved = await readCombinedAmountSaved(client, normalizedAccount, blockNumber);
	const existingUser = await db.find(savingsUserLeaderboard, { id: normalizedAccount });

	await db
		.insert(savingsUserLeaderboard)
		.values({ id: normalizedAccount, amountSaved, interestReceived: 0n })
		.onConflictDoUpdate(() => ({ amountSaved }));

	if (!existingUser) {
		await db
			.insert(savingsStats)
			.values({ id: 'global', totalUsers: 1, lastUpdated: timestamp })
			.onConflictDoUpdate((row) => ({
				totalUsers: row.totalUsers + 1,
				lastUpdated: timestamp,
			}));
	}
}

export async function syncSavingsTotalHistory(db: Db, client: Client, timestamp: bigint): Promise<void> {
	const totalSaved = await readTotalSavedAcrossVersions(client);
	const startTime = (timestamp / 86400n) * 86400n;

	await db
		.insert(savingsTotalHistory)
		.values({ id: startTime.toString(), time: startTime, total: totalSaved })
		.onConflictDoUpdate(() => ({ total: totalSaved }));
}
