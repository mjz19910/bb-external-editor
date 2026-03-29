export function autocomplete(data: AutocompleteData, args: ScriptArg[]) {
	// return data.servers
	if (args.length == 0) {
		return ["n00dles"]
	}
	return []
}
export async function main(ns: NS) {
	ns.ui.openTail()
	ns.ui.resizeTail(623.8, 35 + 24 * 5)
	await ns.weaken(ns.args[0] as string)
}