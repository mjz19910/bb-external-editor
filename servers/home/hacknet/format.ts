/** Format numbers consistently for display */
export function formatNumber(ns: NS, value: number, precision = 2): string {
	if (!ns) return value.toString();
	return ns.format.number(value, precision);
}

/** Format time in hh:mm:ss */
export function formatTime(seconds: number): string {
	if (seconds === Infinity) return "---";
	if (seconds <= 0) return "0s";
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);
	return `${h}h ${m}m ${s}s`;
}
