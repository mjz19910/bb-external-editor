import { AutocompleteData } from "../NetscriptDefinitions";

export async function main(ns: NS) {
	await ns.grow(ns.args[0] as string);
}

export function autocomplete(data: AutocompleteData) {
	return data.servers;
}
