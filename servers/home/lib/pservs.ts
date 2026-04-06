export type PurchasedServerInfo = {
	host: string
	ram: number
	usedRam: number
	freeRam: number
}

export type PurchasedServerBuyOption = {
	kind: "buy"
	ram: number
	cost: number
	ramGain: number
	value: number
}

export type PurchasedServerUpgradeOption = {
	kind: "upgrade"
	host: string
	fromRam: number
	toRam: number
	cost: number
	ramGain: number
	value: number
}

export type PurchasedServerAction =
	| PurchasedServerBuyOption
	| PurchasedServerUpgradeOption

export class PurchasedServers {
	private readonly ns: NS
	private list: PurchasedServerInfo[] = []

	constructor(ns: NS) {
		this.ns = ns
		this.refresh()
	}

	refresh(): PurchasedServerInfo[] {
		this.list = this.ns.cloud.getServerNames()
			.map((host) => {
				const ram = this.ns.getServerMaxRam(host)
				const usedRam = this.ns.getServerUsedRam(host)

				return {
					host,
					ram,
					usedRam,
					freeRam: ram - usedRam,
				}
			})
			.sort((a, b) => a.ram - b.ram)

		return this.list
	}

	getInfo(): PurchasedServerInfo[] {
		return this.list
	}

	maxRam(): number {
		return this.ns.cloud.getRamLimit()
	}

	limit(): number {
		return this.ns.cloud.getServerLimit()
	}

	count(): number {
		return this.list.length
	}

	cost(ram: number): number {
		return this.ns.cloud.getServerCost(ram)
	}

	hasCapacity(): boolean {
		return this.count() < this.limit()
	}

	worst(): PurchasedServerInfo | null {
		return this.list[0] ?? null
	}

	best(): PurchasedServerInfo | null {
		return this.list[this.list.length - 1] ?? null
	}

	totalRam(): number {
		return this.list.reduce((sum, server) => sum + server.ram, 0)
	}

	totalUsedRam(): number {
		return this.list.reduce((sum, server) => sum + server.usedRam, 0)
	}

	totalFreeRam(): number {
		return this.list.reduce((sum, server) => sum + server.freeRam, 0)
	}

	nextAffordableRam(
		budget: number,
		minRam = 8,
		maxRam = this.maxRam(),
	): number {
		let ram = minRam
		let best = 0

		while (ram <= maxRam) {
			const cost = this.ns.cloud.getServerCost(ram)
			if (cost > budget) break
			best = ram
			ram *= 2
		}

		return best
	}

	nextAffordableUpgrade(
		host: string,
		budget: number,
		minRam = 8,
		maxRam = this.maxRam(),
	): { best: number, nextCost: number } {
		const currentRam = this.ns.getServerMaxRam(host)
		let ram = Math.max(minRam, currentRam * 2)
		let best = 0
		let next = 0

		while (ram <= maxRam) {
			const cost = this.ns.cloud.getServerUpgradeCost(host, ram)
			if (cost > budget) {
				next = cost
				break
			}
			best = ram
			ram *= 2
		}

		return {
			best,
			nextCost: next,
		}
	}

	getBestBuyOption(
		budget: number,
		minRam = 8,
		maxRam = this.maxRam(),
	): PurchasedServerBuyOption | null {
		if (!this.hasCapacity()) return null

		const ram = this.nextAffordableRam(budget, minRam, maxRam)
		if (ram <= 0) return null

		const cost = this.cost(ram)
		const ramGain = ram

		return {
			kind: "buy",
			ram,
			cost,
			ramGain,
			value: ramGain / Math.max(cost, 1),
		}
	}

	getBestUpgradeOption(
		budget: number,
		minRam = 8,
		maxRam = this.maxRam(),
	): PurchasedServerUpgradeOption | null {
		let bestOption: PurchasedServerUpgradeOption | null = null

		for (const server of this.list) {
			const { best: toRam } = this.nextAffordableUpgrade(
				server.host,
				budget,
				minRam,
				maxRam,
			)

			if (toRam <= server.ram) continue

			const cost = this.ns.cloud.getServerUpgradeCost(server.host, toRam)
			const ramGain = toRam - server.ram
			const value = ramGain / Math.max(cost, 1)

			const option: PurchasedServerUpgradeOption = {
				kind: "upgrade",
				host: server.host,
				fromRam: server.ram,
				toRam,
				cost,
				ramGain,
				value,
			}

			if (!bestOption || option.value > bestOption.value) {
				bestOption = option
			}
		}

		return bestOption
	}

	getBestAction(
		budget: number,
		minRam = 8,
		maxRam = this.maxRam(),
	): PurchasedServerAction | null {
		const buy = this.getBestBuyOption(budget, minRam, maxRam)
		const upgrade = this.getBestUpgradeOption(budget, minRam, maxRam)

		if (!buy) return upgrade
		if (!upgrade) return buy

		return buy.value >= upgrade.value ? buy : upgrade
	}
}
