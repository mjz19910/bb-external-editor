export async function main(ns: NS) {
	ns.ui.openTail()
	ns.ui.resizeTail(623.8, 35 + 24 * 5)
	for (const target of ns.args) {
		if (typeof target != "string") continue;
		await ns.weaken(target)
	}
}

export function autocomplete(data: AutocompleteData, _args: ScriptArg[]) {
	return data.servers
}
