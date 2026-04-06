// grow.ts
import { handleRequest } from "../lib/handleRequest"
import { HgwRequest, parseHgwRequest } from "../lib/hgw-message"

export async function main(ns: NS) {
	const req = parseHgwRequest(ns)
	await handleRequest(ns, req, async (data: HgwRequest) => {
		return ns.grow(data.target, { additionalMsec: data.offset })
	})
}
