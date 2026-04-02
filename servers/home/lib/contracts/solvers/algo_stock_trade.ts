import { ContractData } from "../contracts"

export default {
	type: "Algorithmic Stock Trader I",

	/** Solver for automation system */
	solve: function (c_data: ContractData, ns?: NS): boolean {
		const data = c_data.object
		if (data.type !== "Algorithmic Stock Trader I") return false
		const prices = data.data as number[]
		if (!prices || prices.length < 2) return false

		const maxProfit = stock_trader1(prices)

		if (ns && c_data.server && c_data.filename) {
			// Attempt contract if NS context is provided
			const reward = ns.codingcontract.attempt(maxProfit, c_data.filename, c_data.server)
			ns.tprint(`Attempted contract on ${c_data.server}: ${reward}`)
		}

		return true // we computed the answer
	}
}

/** Compute max profit for single-transaction stock trader */
export function stock_trader1(prices: number[]): number {
	let minPrice = Infinity
	let maxProfit = 0

	for (const price of prices) {
		if (price < minPrice) minPrice = price
		else maxProfit = Math.max(maxProfit, price - minPrice)
	}

	return maxProfit
}
