// PERMANENT contract errors may safely fall back. TRANSIENT RPC errors must propagate because Ponder's RPC layer already retries them with
// backoff; using a fallback for those errors would silently corrupt the database.

const PERMANENT_CONTRACT_ERROR_NAMES = new Set([
	'ContractFunctionRevertedError', // The contract function reverted.
	'ContractFunctionZeroDataError', // The contract function returned no data.
	'ExecutionRevertedError', // EVM execution reverted.
	'RawContractError', // The RPC returned a raw contract execution error.
	'AbiErrorSignatureNotFoundError', // The returned ABI error signature is unknown.
	'AbiFunctionNotFoundError', // The requested function is absent from the ABI.
	'AbiDecodingZeroDataError', // ABI decoding received no data.
	'AbiDecodingDataSizeTooSmallError', // ABI decoding received too little data.
	'AbiDecodingDataSizeInvalidError', // ABI decoding received incorrectly sized data.
	'InvalidAddressError', // The contract address is invalid.
]);

const PERMANENT_REVERT_CODES = new Set([3, -32000, -32015]);

export function isPermanentContractError(error: unknown): boolean {
	const seen = new Set<object>();
	let current = error;

	while (typeof current === 'object' && current !== null && !seen.has(current)) {
		seen.add(current);
		const value = current as Record<string, unknown>;

		if (typeof value.name === 'string' && PERMANENT_CONTRACT_ERROR_NAMES.has(value.name)) return true;
		if (
			typeof value.code === 'number' &&
			PERMANENT_REVERT_CODES.has(value.code) &&
			typeof value.message === 'string' &&
			/revert/i.test(value.message)
		) {
			return true;
		}

		current = value.cause;
	}

	return false;
}

function describe(error: unknown): string {
	const seen = new Set<object>();
	let current = error;

	while (typeof current === 'object' && current !== null && !seen.has(current)) {
		seen.add(current);
		const value = current as Record<string, unknown>;
		if (typeof value.shortMessage === 'string') return value.shortMessage;
		current = value.cause;
	}

	return error instanceof Error ? error.message : String(error);
}

export async function readWithFallback<T>(read: () => Promise<T>, fallback: T, label: string): Promise<T> {
	try {
		return await read();
	} catch (error) {
		if (isPermanentContractError(error)) {
			console.warn(`[readWithFallback] ${label}: permanent contract error, using fallback. ${describe(error)}`);
			return fallback;
		}
		throw error;
	}
}
