export async function main(ns: NS) {
	class Walker {
		results: string[] = []
		pending: string[] = []
		result_set = new Set()
		walk(target: string) {
			if (this.result_set.has(target)) return
			this.results.push(target)
			this.result_set.add(target)
			const children = ns.scan(target)
			for (const item of children) {
				if (this.result_set.has(item)) continue
				this.pending.push(item)
			}
		}
	}
	const w = new Walker()
	w.walk("home")
	while (w.pending.length > 0) {
		const p = w.pending
		w.pending = []
		for (const v of p) {
			w.walk(v)
		}
	}
	for (const server of w.results) {
		if (server === "home") continue
		const files = ns.ls(server)
		for (const file of files) {
			if (file.endsWith(".cct")) continue
			if (!file.endsWith(".js") && !file.endsWith(".ts") && !file.endsWith(".txt") &&
				!file.endsWith(".json") && !file.endsWith(".css") && !file.endsWith(".jsx") && !file.endsWith(".tsx")) {
				ns.scp(file, "home", server)
				ns.rm(file, server)
				ns.tprint(`Moved ${file} on ${server} -> home`)
				continue
			}
			ns.tprint(`Found ${file} on ${server}`)
		}
	}
}