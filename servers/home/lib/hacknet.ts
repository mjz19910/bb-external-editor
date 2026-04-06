export type HacknetUpgradeKind =
	| "new"
	| "level"
	| "ram"
	| "core"
	| "cache"

export type HacknetOption = {
	kind: HacknetUpgradeKind
	node: number // -1 for new node
	cost: number
	gain: number // estimated production gain/sec
	roi: number // gain / cost
	label: string
}

export type HacknetNodeInfo = {
	index: number
	stats: NodeStats
}

type ProjectedNodeStats = {
	level: number
	ram: number
	cores: number
	cache: number
}

export class HacknetManager {
	private readonly ns: NS
	private nodes: HacknetNodeInfo[] = []

	constructor(ns: NS) {
		this.ns = ns
		this.refresh()
	}

	refresh(): HacknetNodeInfo[] {
		const out: HacknetNodeInfo[] = []
		const count = this.ns.hacknet.numNodes()

		for (let i = 0; i < count; i++) {
			out.push({
				index: i,
				stats: this.ns.hacknet.getNodeStats(i),
			})
		}

		this.nodes = out
		return this.nodes
	}

	getNodes(): HacknetNodeInfo[] {
		return this.nodes
	}

	count(): number {
		return this.nodes.length
	}

	totalProduction(): number {
		return this.nodes.reduce((sum, node) => sum + node.stats.production, 0)
	}

	totalLevel(): number {
		return this.nodes.reduce((sum, node) => sum + node.stats.level, 0)
	}

	totalRam(): number {
		return this.nodes.reduce((sum, node) => sum + node.stats.ram, 0)
	}

	totalCores(): number {
		return this.nodes.reduce((sum, node) => sum + node.stats.cores, 0)
	}

	/**
	 * Approximate Hacknet Node production formula.
	 *
	 * For Hacknet Nodes, production scales with:
	 * - level (linear)
	 * - ram (1.035^(ram-1) style scaling)
	 * - cores ((cores + 5) / 6)
	 *
	 * This is much closer to game behavior than simple proportional guesses.
	 */
	private projectedProduction(stats: ProjectedNodeStats): number {
		const playerMult = this.ns.getPlayer().mults.hacknet_node_money ?? 1

		const levelMult = stats.level
		const ramMult = Math.pow(1.035, stats.ram - 1)
		const coreMult = (stats.cores + 5) / 6

		return levelMult * ramMult * coreMult * playerMult
	}

	private currentProjectedProduction(i: number): number {
		const s = this.ns.hacknet.getNodeStats(i)

		return this.projectedProduction({
			level: s.level,
			ram: s.ram,
			cores: s.cores,
			cache: s.cache!,
		})
	}

	private projectedGain(
		i: number,
		changes: Partial<ProjectedNodeStats>,
	): number {
		const s = this.ns.hacknet.getNodeStats(i)

		const before = this.projectedProduction({
			level: s.level,
			ram: s.ram,
			cores: s.cores,
			cache: s.cache!,
		})

		const after = this.projectedProduction({
			level: changes.level ?? s.level,
			ram: changes.ram ?? s.ram,
			cores: changes.cores ?? s.cores,
			cache: changes.cache ?? s.cache!,
		})

		return Math.max(0, after - before)
	}

	private gainFromLevel(i: number, amount = 1): number {
		const s = this.ns.hacknet.getNodeStats(i)
		return this.projectedGain(i, { level: s.level + amount })
	}

	private gainFromRam(i: number, amount = 1): number {
		const s = this.ns.hacknet.getNodeStats(i)
		return this.projectedGain(i, { ram: s.ram * Math.pow(2, amount) })
	}

	private gainFromCore(i: number, amount = 1): number {
		const s = this.ns.hacknet.getNodeStats(i)
		return this.projectedGain(i, { cores: s.cores + amount })
	}

	private gainFromCache(_i: number, _amount = 1): number {
		// Cache does not increase money production for Hacknet Nodes
		return 0
	}

	private gainFromNewNode(): number {
		// Fresh node baseline: level 1, ram 1, cores 1, cache 1
		return this.projectedProduction({
			level: 1,
			ram: 1,
			cores: 1,
			cache: 1,
		})
	}

	getOptions(): HacknetOption[] {
		const options: HacknetOption[] = []
		const count = this.count()

		const newCost = this.ns.hacknet.getPurchaseNodeCost()
		if (isFinite(newCost) && newCost > 0) {
			const gain = this.gainFromNewNode()

			options.push({
				kind: "new",
				node: -1,
				cost: newCost,
				gain,
				roi: gain / newCost,
				label: "new node",
			})
		}

		for (const node of this.nodes) {
			const i = node.index

			const levelCost = this.ns.hacknet.getLevelUpgradeCost(i, 1)
			if (isFinite(levelCost) && levelCost > 0) {
				const gain = this.gainFromLevel(i, 1)
				options.push({
					kind: "level",
					node: i,
					cost: levelCost,
					gain,
					roi: gain / levelCost,
					label: `node ${i} +1 level`,
				})
			}

			const ramCost = this.ns.hacknet.getRamUpgradeCost(i, 1)
			if (isFinite(ramCost) && ramCost > 0) {
				const gain = this.gainFromRam(i, 1)
				options.push({
					kind: "ram",
					node: i,
					cost: ramCost,
					gain,
					roi: gain / ramCost,
					label: `node ${i} x2 ram`,
				})
			}

			const coreCost = this.ns.hacknet.getCoreUpgradeCost(i, 1)
			if (isFinite(coreCost) && coreCost > 0) {
				const gain = this.gainFromCore(i, 1)
				options.push({
					kind: "core",
					node: i,
					cost: coreCost,
					gain,
					roi: gain / coreCost,
					label: `node ${i} +1 core`,
				})
			}

			const cacheCost = this.ns.hacknet.getCacheUpgradeCost(i, 1)
			if (isFinite(cacheCost) && cacheCost > 0) {
				const gain = this.gainFromCache(i, 1)
				options.push({
					kind: "cache",
					node: i,
					cost: cacheCost,
					gain,
					roi: gain / Math.max(1, cacheCost),
					label: `node ${i} +1 cache`,
				})
			}
		}

		return options.filter((o) => isFinite(o.cost) && o.cost > 0)
	}

	getAffordableOptions(budget: number): HacknetOption[] {
		return this.getOptions()
			.filter((o) => o.cost <= budget)
			.sort((a, b) => b.roi - a.roi || a.cost - b.cost)
	}

	chooseBestOption(budget = Infinity): HacknetOption | null {
		const options = this.getAffordableOptions(budget)
			.filter((o) => o.gain > 0)

		return options[0] ?? null
	}

	applyOption(opt: HacknetOption): boolean {
		switch (opt.kind) {
			case "new":
				return this.ns.hacknet.purchaseNode() !== -1
			case "level":
				return this.ns.hacknet.upgradeLevel(opt.node, 1)
			case "ram":
				return this.ns.hacknet.upgradeRam(opt.node, 1)
			case "core":
				return this.ns.hacknet.upgradeCore(opt.node, 1)
			case "cache":
				return this.ns.hacknet.upgradeCache(opt.node, 1)
			default:
				return false
		}
	}

	getPaybackTimeSeconds(opt: HacknetOption): number {
		if (opt.gain <= 0) return Infinity
		return opt.cost / opt.gain
	}
}
