export async function main(ns: NS) {
	ns.ui.openTail()
	await ns.hack(ns.args[0] as string)
}

export function autocomplete(data: AutocompleteData) {
	return data.servers
}
