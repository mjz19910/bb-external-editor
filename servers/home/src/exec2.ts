export function exec(ns: NS, script: string, runner: string, threads: number, ...args: ScriptArg[]) {
	return ns.exec(script, runner, threads, "--runner", runner, "--threads", threads, ...args)
}