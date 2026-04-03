import { ContractData, getSolver } from "../lib/contracts/contracts"

export async function main(ns: NS) {
	const data = ns.read("lib/db/contracts_found.json")
	if (!data) {
		ns.tprint("No contracts found. Run contracts_scan.ts first.")
		return
	}

	const contracts: ContractData[] = JSON.parse(data)

	for (const c of contracts) {
		const solver = await getSolver(ns, c.type.replace(/\s+/g, "_").toLowerCase())
		if (!solver) {
			ns.tprint(`No solver for contract type "${c.type}" on ${c.server}`)
			continue
		}

		const success = solver.solve(c)
		if (success) {
			ns.tprint(`Solved contract ${c.filename} on ${c.server}`)
			// optionally: reward logging
		} else {
			ns.tprint(`Failed to solve contract ${c.filename} on ${c.server}`)
		}
	}
}
