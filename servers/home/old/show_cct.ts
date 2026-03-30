import { NS } from "../@ns"

export async function main(ns: NS) {
	const contracts = ns.ls("home").filter(f => f.endsWith(".cct"))
	ns.tprint("Available coding contracts: " + contracts.join(", "))
}