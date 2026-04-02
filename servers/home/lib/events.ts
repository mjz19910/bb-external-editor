// lib/events.ts
/** A lightweight event bus for Bitburner scripts */
// TODO: extend this into a cross-script version that works with Bitburner ports

export type EventType =
	| "TARGET_PREPPED"
	| "BATCH_STARTED"
	| "BATCH_FAILED"
	| "SERVER_ROOTED"
	| "RAM_LOW"
	| "NEW_BEST_TARGET"
	| "SERVER_PURCHASED"
	| "WORKER_KILLED"

type EventCallback<T = any> = (payload: T) => void

class EventBus {
	private listeners: Map<EventType, Set<EventCallback>>

	constructor() {
		this.listeners = new Map()
	}

	/** Subscribe to an event */
	on<T = any>(event: EventType, callback: EventCallback<T>) {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set())
		}
		this.listeners.get(event)!.add(callback)
	}

	/** Unsubscribe from an event */
	off<T = any>(event: EventType, callback: EventCallback<T>) {
		this.listeners.get(event)?.delete(callback)
	}

	/** Trigger an event */
	emit<T = any>(event: EventType, payload?: T) {
		this.listeners.get(event)?.forEach(cb => {
			try {
				cb(payload)
			} catch (e) {
				console.error(`Error in event callback for ${event}:`, e)
			}
		})
	}

	/** Clear all listeners (optional utility) */
	clear() {
		this.listeners.clear()
	}
}

// Singleton instance
export const Events = new EventBus()
