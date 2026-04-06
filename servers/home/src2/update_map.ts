import { NetworkMap } from "./NetworkMap"

export function main(ns: NS) {
	const map = NetworkMap.build(ns)
	map.refresh(ns)
}
