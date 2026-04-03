import { TargetRegistry } from "./types"

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
