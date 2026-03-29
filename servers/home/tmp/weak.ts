export async function main(ns: NS) {
	for (const target of ns.args) {
		if (typeof target != "string") continue;
		await ns.weaken(target)
	}
}

export function autocomplete(data: AutocompleteData, _args: ScriptArg[]) {
	return data.servers
}

export { main as run_weaken }
