/** rename_workers.ts */

export async function main(ns: NS) {
	const servers = ns.cloud.getServerNames()

	// Rename from end to avoid collisions
	for (let i = servers.length - 1; i >= 0; i--) {
		const oldName = servers[i]

		const newIndex = i
		const newName = `worker-${("" + (newIndex + 1)).padStart(2, "0")}`

		if (oldName === newName) continue

		try {
			ns.cloud.renameServer(oldName, newName)
			ns.tprint(`Renamed ${oldName} → ${newName}`)
		} catch (e) {
			ns.tprint(`Failed to rename ${oldName}: ${e}`)
		}
	}

	ns.tprint("Worker rename complete.")
}