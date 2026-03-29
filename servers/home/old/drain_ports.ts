import { Com } from "com"

export async function main(ns: NS) {
	let portNumber = 1
	let emptyInRow = 0

	while (emptyInRow < 5) {
		const com = new Com(ns, portNumber)
		const msgs = com.readAll()
		if (msgs.length > 0) {
			for (const msg of msgs) ns.tprint(["startup msg", portNumber, msg])
			emptyInRow = 0
		} else {
			emptyInRow++
		}

		portNumber++
	}
}