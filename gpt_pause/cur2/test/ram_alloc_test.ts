import { getFleet } from "../lib/fleet"
import { RamAllocator } from "../lib/ram_allocator"

export async function main(ns: NS) {
	ns.disableLog("ALL")

	const fleet = getFleet(ns)
	const allocator = new RamAllocator(fleet, 128)

	const weakenRam = ns.getScriptRam("/lib/weaken.js")
	const growRam = ns.getScriptRam("/lib/grow.js")
	const hackRam = ns.getScriptRam("/lib/hack.js")

	ns.tprint("=== BEFORE ===")
	ns.tprint(allocator.summary())

	const a = allocator.allocate({
		label: "weaken-n00dles",
		scriptRam: weakenRam,
		threads: 500,
	})

	const b = allocator.allocate({
		label: "grow-foodnstuff",
		scriptRam: growRam,
		threads: 250,
		allowPartial: true,
	})

	const c = allocator.allocate({
		label: "hack-sigma-cosmetics",
		scriptRam: hackRam,
		threads: 100,
		allowPartial: true,
	})

	ns.tprint("")
	ns.tprint("=== RESULTS ===")
	ns.tprint(JSON.stringify(a, null, 2))
	ns.tprint(JSON.stringify(b, null, 2))
	ns.tprint(JSON.stringify(c, null, 2))

	ns.tprint("")
	ns.tprint("=== AFTER ===")
	ns.tprint(allocator.summary())
}
