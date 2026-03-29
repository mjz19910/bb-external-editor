export async function main(ns: NS) {
	let contract: string | null = null
	if (typeof ns.args[0] === "string") {
		if (!ns.args[0].endsWith(".cct")) return ns.tprint("First argument must be a .cct file")
		contract = ns.args[0]
	}
	if (!contract) return ns.tprint("no contract selected")

	const host = ns.args[1] as string

	// Get contract data
	const cc_obj = ns.codingcontract.getContract(contract, host)
	if (!cc_obj) {
		ns.tprint("Could not read contract " + contract)
		return
	}

	if (cc_obj.type === "Algorithmic Stock Trader I") {
		const prices = cc_obj.data
		if (prices.length < 2) return ns.tprint("Need at least 2 prices to compute profit.")

		// Calculate max profit
		const maxProfit = stock_trader_simple(prices)

		const reward = ns.codingcontract.attempt(maxProfit, contract, host)
		ns.tprint(reward)
		return ns.tprint(`Maximum profit for single transaction: ${maxProfit}`)
	}
	ns.tprint("missing contract solver for ", cc_obj.type)
}

/** Compute max profit for single-transaction stock trader */
export function stock_trader_simple(prices: number[]) {
	let minPrice = Infinity
	let maxProfit = 0

	for (const price of prices) {
		if (price < minPrice) minPrice = price
		else maxProfit = Math.max(maxProfit, price - minPrice)
	}

	return maxProfit
}