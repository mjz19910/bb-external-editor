// lib/ram_allocator.ts

import { Fleet, FleetHost } from "../../../servers/home/src2/fleet"

export type RamReservation = {
	host: string
	threads: number
	ram: number
}

export type AllocationRequest = {
	label: string
	scriptRam: number
	threads: number
	allowPartial?: boolean
	preferredHosts?: string[]
}

export type AllocationResult = {
	label: string
	scriptRam: number
	requestedThreads: number
	allocatedThreads: number
	reservations: RamReservation[]
	success: boolean
}

export class RamAllocator {
	private hostFree = new Map<string, number>()
	private hostMax = new Map<string, number>()

	constructor(
		private fleet: Fleet,
		private reserveHomeRam = 64
	) {
		for (const h of fleet.hosts) {
			let free = h.freeRam
			if (h.host === "home") {
				free = Math.max(0, free - reserveHomeRam)
			}
			this.hostFree.set(h.host, free)
			this.hostMax.set(h.host, h.maxRam)
		}
	}

	/** Current free RAM snapshot after reservations */
	getFreeRam(host: string): number {
		return this.hostFree.get(host) ?? 0
	}

	/** Total currently available RAM */
	getTotalFreeRam(): number {
		let total = 0
		for (const v of this.hostFree.values()) total += v
		return total
	}

	/** Return hosts sorted by best fit for large jobs */
	private getCandidateHosts(preferredHosts?: string[]): FleetHost[] {
		const pref = new Set(preferredHosts ?? [])

		const hosts = [...this.fleet.hosts].filter(h => (this.hostFree.get(h.host) ?? 0) > 0)

		hosts.sort((a, b) => {
			const aPref = pref.has(a.host) ? 1 : 0
			const bPref = pref.has(b.host) ? 1 : 0
			if (aPref !== bPref) return bPref - aPref

			const aFree = this.hostFree.get(a.host) ?? 0
			const bFree = this.hostFree.get(b.host) ?? 0

			// Large-first packing reduces fragmentation
			return bFree - aFree
		})

		return hosts
	}

	/**
	 * Reserve RAM for a thread-based script launch.
	 * Packs across multiple hosts if needed.
	 */
	allocate(req: AllocationRequest): AllocationResult {
		const { label, scriptRam, threads, allowPartial = false, preferredHosts } = req

		if (scriptRam <= 0 || threads <= 0) {
			return {
				label,
				scriptRam,
				requestedThreads: threads,
				allocatedThreads: 0,
				reservations: [],
				success: false,
			}
		}

		let remaining = threads
		const reservations: RamReservation[] = []

		for (const host of this.getCandidateHosts(preferredHosts)) {
			if (remaining <= 0) break

			const free = this.hostFree.get(host.host) ?? 0
			const maxThreads = Math.floor(free / scriptRam)
			if (maxThreads <= 0) continue

			const take = Math.min(maxThreads, remaining)
			const ram = take * scriptRam

			this.hostFree.set(host.host, free - ram)
			reservations.push({
				host: host.host,
				threads: take,
				ram,
			})

			remaining -= take
		}

		const allocatedThreads = threads - remaining
		const success = allowPartial ? allocatedThreads > 0 : allocatedThreads === threads

		// Roll back if full allocation required and failed
		if (!success) {
			for (const r of reservations) {
				this.hostFree.set(r.host, (this.hostFree.get(r.host) ?? 0) + r.ram)
			}
			return {
				label,
				scriptRam,
				requestedThreads: threads,
				allocatedThreads: 0,
				reservations: [],
				success: false,
			}
		}

		return {
			label,
			scriptRam,
			requestedThreads: threads,
			allocatedThreads,
			reservations,
			success: true,
		}
	}

	/** Manually release RAM if a planned job is cancelled */
	release(reservations: RamReservation[]) {
		for (const r of reservations) {
			this.hostFree.set(r.host, (this.hostFree.get(r.host) ?? 0) + r.ram)
		}
	}

	/** Debug helper */
	summary(): string {
		const rows = [...this.hostFree.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([host, free]) => {
				const max = this.hostMax.get(host) ?? 0
				return `${host.padEnd(20)} ${free.toFixed(2).padStart(8)} / ${max.toFixed(2)} GB`
			})

		return rows.join("\n")
	}
}
