/** Postgres rejects NUL bytes in text columns and a malicious token can return arbitrarily long names. */
export function sanitizeText(value: unknown, maxLength = 64): string {
	if (typeof value !== 'string') return '';
	// eslint-disable-next-line no-control-regex
	const cleaned = value.replace(/[\u0000-\u001f\u007f-\u009f\ufffd]/g, '').trim();
	return cleaned.slice(0, maxLength);
}

/**
 * viem decodes uint8 without range checking, so a hostile token can return a value that overflows the Postgres integer column
 * collateralDecimals.
 */
export function sanitizeDecimals(value: unknown, fallback = 18): number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255 ? value : fallback;
}
