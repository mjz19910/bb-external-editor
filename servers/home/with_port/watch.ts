import { Com } from "lib/port"

async function* watchPorts<T>(a: Com<T>[]): AsyncIterableIterator<[number, Com<T>]> {
	const waits = a.map((c, i) => c.nextWrite().then(() => i))
	for (; ;) {
		const r = await Promise.race(waits)
		waits[r] = a[r].nextWrite().then(() => r)
		yield [r, a[r]]
	}
}

function submit<T>(ns: NS, idx: number, com: Com<T>) {
	const msgs = com.readAll()
	for (const a of msgs) {
		ns.tprint("msg ", idx + 1, " ", JSON.stringify(a, void 0, 1))
	}
	return msgs.length
}

function fillBuf<T>(ns: NS) {
	const a: Com<T>[] = []
	let portNumber = 1
	let emptyInRow = 0
	while (emptyInRow < 5) {
		const com = new Com<T>(ns, portNumber)
		const count = submit(ns, portNumber, com)
		if (count > 0) {
			a.push(com)
			emptyInRow = 0
		} else {
			emptyInRow++
		}
		portNumber++
	}
	return a;
}

export async function main(ns: NS) {
	for await (const v of watchPorts(fillBuf(ns))) {
		const jobs = submit(ns, ...v)
		ns.tprint("processed ", jobs, " messages")
	}
}