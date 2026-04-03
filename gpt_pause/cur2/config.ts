/**
 * Central configuration for Bitburner automation scripts.
 * All tunable parameters are in one place for easy adjustment.
 */

export const Config = {
	// === HOME SERVER SETTINGS ===
	homeReservedRam: 16,           // GB to leave free on home for manual scripts / buffer
	homeMaxThreadsPercent: 0.9,    // Max % of home RAM to use for jobs

	// === PURCHASED SERVER SETTINGS ===
	maxPurchasedServers: 25,       // Maximum number of purchased servers
	pservReservedRam: 2,           // GB to reserve on purchased servers (always free)
	pservMaxRamUsagePercent: 0.95, // Max RAM % to use for jobs

	// === BATCH / HACK SETTINGS ===
	batchHackPercent: 0.05,        // % of target money to hack per batch
	prepGrowThreshold: 0.98,       // Grow until target money >= 98% of max
	prepWeakenThreshold: 1.02,     // Weaken until security delta <= 2%
	batchCooldownMs: 50,           // Delay between batch launches in ms
	minBatchGapMs: 10,             // Minimal gap to avoid collisions

	// === LOGGING ===
	loggingLevel: 'info' as 'info' | 'warn' | 'error' | 'debug',

	// === DASHBOARD / UI ===
	dashboardRefreshMs: 500,        // Interval to refresh dashboard

	// === SCRIPT PORT / EVENTS ===
	scriptPort: 1,                  // Port for sending messages between scripts
	eventTimeoutMs: 5000,           // Timeout for expected events

	// === TARGET SELECTION ===
	targetScoreWeights: {
		moneyPerSec: 0.5,           // Weight for money per second
		successChance: 0.3,         // Weight for chance to succeed
		prepReadiness: 0.2          // Weight for prep readiness
	},

	// === SIMULATION / PLANNING ===
	simBatchIterations: 5,          // Number of iterations for batch simulation per target
	simPrecision: 0.001,            // Precision threshold for thread calculations
}
