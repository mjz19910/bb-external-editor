export function solve(ns: NS, data: CodingContractObject, contract: string, host: string) {
	if (data.type != "Algorithmic Stock Trader I") {
		return false
	}
	const prices = data.data
	if (prices.length < 2) {
		return ns.tprint("Need at least 2 prices to compute profit.")
	}

	// Calculate max profit
	const maxProfit = stock_trader1(prices)

	const reward = ns.codingcontract.attempt(maxProfit, contract, host)
	ns.tprint(reward)
	return ns.tprint(`Maximum profit for single transaction: ${maxProfit}`)
}

/** Compute max profit for single-transaction stock trader */
export function stock_trader1(prices: number[]) {
	let minPrice = Infinity
	let maxProfit = 0

	for (const price of prices) {
		if (price < minPrice) minPrice = price
		else maxProfit = Math.max(maxProfit, price - minPrice)
	}

	return maxProfit
}
