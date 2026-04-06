import { TargetRegistry } from "./types"

const REGISTRY_FILE = "/data/targetRegistry.json"

let registry: TargetRegistry = {
	byHostname: {},
	activeFarmTargets: [],
	lastUpdatedAt: 0,
}

export function getTargetRegistry(): TargetRegistry {
	return registry
}

export function setTargetRegistry(next: TargetRegistry): void {
	registry = next
}

export function resetTargetRegistry(): void {
	registry = {
		byHostname: {},
		activeFarmTargets: [],
		lastUpdatedAt: 0,
	}
}

export async function loadTargetRegistry(ns: NS): Promise<void> {
	try {
		const data = ns.read(REGISTRY_FILE)
		if (!data) {
			resetTargetRegistry()
			return
		}

		const parsed = JSON.parse(data) as Partial<TargetRegistry> & {
			activeFarmTarget?: string | null
		}

		registry = {
			byHostname: parsed.byHostname ?? {},
			activeFarmTargets: parsed.activeFarmTargets
				?? (parsed.activeFarmTarget ? [parsed.activeFarmTarget] : []),
			lastUpdatedAt: parsed.lastUpdatedAt ?? 0,
		}
	} catch {
		ns.print("Failed to load registry, starting fresh.")
		resetTargetRegistry()
	}
}

export function saveTargetRegistry(ns: NS) {
	try {
		ns.write(REGISTRY_FILE, JSON.stringify(registry), "w")
	} catch (e) {
		ns.print("Failed to save registry: " + e)
	}
}
