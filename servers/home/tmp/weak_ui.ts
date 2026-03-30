import { NS } from "../@ns";
import { run_weaken } from "./weak";

export async function main(ns: NS) {
	ns.ui.openTail();
	ns.ui.resizeTail(623.8, 35 + 24 * 5);
	run_weaken(ns);
}
