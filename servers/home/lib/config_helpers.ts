/**
 * Config Helpers
 * Safely read Config values with defaults.
 * Avoids breaking scripts when new fields are added.
 */

import { Config } from "../config"

/**
 * Get a config value with a default fallback.
 * @param key The key of the config to get
 * @param defaultValue Value to return if key is missing
 */
export function getConfig<T extends keyof typeof Config>(
	key: T,
	defaultValue: typeof Config[T]
): typeof Config[T] {
	if (key in Config) {
		return Config[key] as typeof Config[T]
	}
	return defaultValue
}

/**
 * Get a nested config value safely
 * Example: getNestedConfig(['targetScoreWeights', 'moneyPerSec'], 0.5)
 */
export function getNestedConfig<T = any>(
	keys: string[],
	defaultValue: T
): T {
	let obj: any = Config
	for (const key of keys) {
		if (obj && key in obj) {
			obj = obj[key]
		} else {
			return defaultValue
		}
	}
	return obj as T
}
