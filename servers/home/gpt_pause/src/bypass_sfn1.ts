import { NS } from "./@ns";

export async function main(ns: NS) {
	(ns as any as { bypass(x: any): void }).bypass(globalThis["document"]);
}
