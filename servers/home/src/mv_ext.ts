import { mvExtended } from "./types/mv.ts"

export async function main(ns: NS) {
	// Parse arguments from command line
	const args = ns.args as string[]
	if (args.length < 2) {
		ns.tprint("Usage: run src/mv_ext.ts <file> <destPath> [server]")
		return
	}

	const file = args[0]                 // file to move
	const destPath = args[1]             // destination path
	const server = args[2] ?? "home"     // optional server, default "home"

	// Call the extended move function
	mvExtended(ns, file, destPath, server)
}
export function autocomplete(data: AutocompleteData, args: ScriptArg[]) {
	// First argument: script/file name
	if (args.length === 0) return data.scripts;

	file: if (args.length === 1) {
		if (typeof args[0] != "string") return []
		const file = args[0]
		if (data.scripts.includes(file)) break file
		return data.scripts.filter(f => f.startsWith(file));
	}

	const topDirs = Array.from(
		new Set(
			data.scripts
				.map(f => f.includes("/") ? f.split("/")[0] + "/" : null)
				.filter((f): f is string => f !== null)
		)
	)

	if (args[1] === void 0) {
		return topDirs
	}

	// Second argument: destination path (only top-level suggestions)
	destPath: {
		if (typeof args[1] != "string") return []
		const dstPath = args[1]
		if (topDirs.includes(dstPath)) break destPath
		return topDirs.filter(d => d.startsWith(dstPath));
	}

	// Third argument: server
	if (args.length === 3) {
		if (typeof args[2] != "string") return []
		const server = args[2]
		return data.servers.filter(s => s.startsWith(server));
	}

	return [];
}