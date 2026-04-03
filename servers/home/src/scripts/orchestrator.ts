import { runAutomationLoop } from "../automation/loop"

export async function main(ns: NS): Promise<void> {
	await runAutomationLoop(ns)
}