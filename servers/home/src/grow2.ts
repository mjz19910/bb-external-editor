export function autocomplete(data: AutocompleteData) {
	return data.servers
}
export async function main(ns: NS) {
	ns.ui.openTail()
	await ns.grow(ns.args[0] as string)
}