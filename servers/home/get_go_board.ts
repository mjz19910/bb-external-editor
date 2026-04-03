export async function main(ns: NS) {
	ns.disableLog("ALL")
	ns.tprintRaw(ns.go.getBoardState().join("\n"))
}
