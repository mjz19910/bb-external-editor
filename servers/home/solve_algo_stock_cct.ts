import * as algo_stock_trade from "./lib/contracts/solvers/algo_stock_trade"

export async function main(ns: NS) {
	let contract: string | null = null
	if (typeof ns.args[0] === "string") {
		if (!ns.args[0].endsWith(".cct")) {
			return ns.tprint("First argument must be a .cct file")
		}
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
		algo_stock_trade.solve(ns, cc_obj, contract, host)
		return
	}
	ns.tprint("missing contract solver for ", cc_obj.type)
}
