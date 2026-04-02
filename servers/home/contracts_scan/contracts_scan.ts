import { ContractData } from "../lib/contracts/contracts"

export async function main(ns: NS) {
	const contracts: ContractData[] = []

	const visited = new Set<string>()
	const queue = ["home"]
	while (queue.length) {
		const s = queue.shift()!
		if (visited.has(s)) continue
		visited.add(s)

		// scan for contracts
		const files = ns.ls(s, ".cct")
		for (const f of files) {
			contracts.push({
				server: s,
				filename: f,
				type: ns.codingcontract.getContractType(f, s),
				desc: ns.codingcontract.getDescription(f, s),
				difficulty: ns.codingcontract.getData(f, s),
				reward: null,
			})
		}

		// add neighbors
		queue.push(...ns.scan(s))
	}

	ns.write("lib/db/contracts_found.json", JSON.stringify(contracts, null, 2), "w")
	ns.tprint(`Found ${contracts.length} contracts.`)
}
