import { read_string_arg, read_number_arg } from "types/arg_parse"
import { exec } from "types/api/exec"
export function main(ns: NS) {
	if (ns.args.length < 3) {
		ns.tprint("too few arguments")
		ns.tprint("run api/exec.ts <script> <hostname> <threads>")
		return
	}
	const [script_arg, runner_arg, threads_arg] = ns.args.splice(0, 3)
	const script = read_string_arg(script_arg)
	const runner = read_string_arg(runner_arg)
	const threads = read_number_arg(threads_arg)
	ns.scp(script, runner)
	exec(ns, script, runner, threads, ...ns.args)
}
export function autocomplete(data: AutocompleteData, args: ScriptArg[]) {
	if (args.length === 0) return data.scripts
	if (args.length === 1) {
		const script = args[0] as string
		if (data.scripts.includes(script)) return data.servers
		const partial = data.scripts.filter(v => v.startsWith(script))
		return partial
	}
	if (args.length === 2) {
		const hostname = args[1] as string
		if (data.servers.includes(hostname)) return ["1"]
		return data.servers
	}
	return []
}