// PERMANENT contract errors may safely fall back: the contract reverted or is not a contract, the returned data does not decode against the
// ABI, or the node aborted execution for gas or execution time. TRANSIENT RPC errors (connectivity, rate limits, provider outages, and
// request timeouts) must propagate because Ponder's RPC layer already retries them with backoff; using a fallback for those errors would
// silently corrupt the database.

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

	'IntegerOutOfRangeError', // A decoded number, offset, or length does not fit (for example, name() returns bytes32 instead of string).
	'PositionOutOfBoundsError', // A dynamic offset or length points outside the returned data.
	'NegativeOffsetError', // A dynamic offset is negative.
	'RecursiveReadLimitExceededError', // The returned data nests dynamic types beyond the decoder's read limit.
	'InvalidBytesBooleanError', // A bool slot is neither 0 nor 1.
	'SizeExceedsPaddingSizeError', // A value is larger than its padded slot.
	'SliceOffsetOutOfBoundsError', // A slice of the returned data is out of bounds.
	'SizeOverflowError', // A value exceeds the size of its type.
	'InvalidBytesLengthError', // A bytes value has the wrong length.
]);

const PERMANENT_REVERT_CODES = new Set([3, -32000, -32015]);

// Measured provider answers include "out of gas" (-32000), "execution aborted (timeout = 5s)" (-32000), and
// "out of gas: gas required exceeds: 50000000" (-32003). Re-executing the same view at the same block can never succeed, and a legitimate
// token view never comes near a node's gas cap or execution timeout.
const PERMANENT_EXECUTION_ABORT_PATTERN = /out of gas|gas required exceeds|execution aborted/i;

/** Walks `error` and its `cause` chain, guarding against cycles. */
function* causeChain(error: unknown): Generator<Record<string, unknown>> {
	const seen = new Set<object>();
	let current = error;
	while (typeof current === 'object' && current !== null && !seen.has(current)) {
		seen.add(current);
		yield current as Record<string, unknown>;
		current = (current as Record<string, unknown>).cause;
	}
}

export function isPermanentContractError(error: unknown): boolean {
	for (const value of causeChain(error)) {
		if (typeof value.name === 'string' && PERMANENT_CONTRACT_ERROR_NAMES.has(value.name)) return true;
		if (
			typeof value.code === 'number' &&
			PERMANENT_REVERT_CODES.has(value.code) &&
			typeof value.message === 'string' &&
			/revert/i.test(value.message)
		) {
			return true;
		}
		if (
			typeof value.code === 'number' &&
			typeof value.message === 'string' &&
			PERMANENT_EXECUTION_ABORT_PATTERN.test(value.message)
		) {
			return true;
		}
	}

	return false;
}

function describe(error: unknown): string {
	for (const value of causeChain(error)) {
		if (typeof value.shortMessage === 'string') return value.shortMessage;
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
