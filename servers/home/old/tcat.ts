import { read_string_arg } from "./types/arg_parse";

export async function main(ns: NS) {
	if (ns.args.length < 1) {
		ns.tprint("need file to cat")
		return
	}
	const file = read_string_arg(ns.args[0]);
	ns.tprint(ns.read(file))
}


export function autocomplete(data: AutocompleteData, args: ScriptArg[], ...other: any[]) {
	console.log(data, args, other)
	return [...data.txts, ...data.scripts];
}