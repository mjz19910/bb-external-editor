export const doc = globalThis["document"]

export function createRow(label: string) {
	const div = doc.createElement("div")
	const span = doc.createElement("span")
	div.innerText = label
	div.appendChild(span)
	return { div, span }
}
