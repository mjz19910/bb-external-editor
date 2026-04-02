export type ContractData = {
	server: string
	filename: string
	type: string
	desc: string
	difficulty: number
	reward: any
}

export type Solver = {
	type: string
	solve: (data: ContractData) => boolean
}

// optional helper to dynamically load a solver by type
export async function getSolver(ns: NS, type: string): Promise<Solver | null> {
	try {
		// dynamic import from solvers folder
		return await ns.dynamicImport(`./solvers/${type}`)
	} catch {
		return null
	}
}
