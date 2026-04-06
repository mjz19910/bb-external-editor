import { handleRequest } from "../lib/handleRequest"
import { parseHgwRequest, HgwRequest } from "../lib/hgw-message"

// weaken.ts
export async function main(ns: NS) {
	const req = parseHgwRequest(ns)
	await handleRequest(ns, req, async (data: HgwRequest) => {
		return ns.weaken(data.target, { additionalMsec: data.offset })
	})
}
