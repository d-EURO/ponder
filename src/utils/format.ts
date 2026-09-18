/**
 * Postgres rejects NUL bytes in text columns, a malicious token can return arbitrarily long names, and a name that is not valid UTF-8
 * arrives as replacement characters. Strip control and replacement characters, trim the result, and truncate it to the configured length.
 */
export function sanitizeText(value: unknown, maxLength = 64): string {
	if (typeof value !== 'string') return '';
	// eslint-disable-next-line no-control-regex
	const cleaned = value.replace(/[\u0000-\u001f\u007f-\u009f\ufffd]/g, '').trim();
	return cleaned.slice(0, maxLength);
}

/**
 * viem does not range-check uint8 values that fit a JavaScript safe integer (a token returning 300 decodes as 300), so this checks the
 * value before it reaches the Postgres integer column collateralDecimals.
 */
export function sanitizeDecimals(value: unknown, fallback = 18): number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255 ? value : fallback;
}
