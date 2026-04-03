import { TargetRegistry } from "../core/types"

const REGISTRY_FILE = "/data/targetRegistry.json"

let registry: TargetRegistry = {
	byHostname: {},
	activeFarmTarget: null,
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
		activeFarmTarget: null,
		lastUpdatedAt: 0,
	}
}

export function loadTargetRegistry(ns: NS) {
	try {
		const data = ns.read(REGISTRY_FILE)
		if (data) {
			registry = JSON.parse(data) as TargetRegistry
		}
	} catch (e) {
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
