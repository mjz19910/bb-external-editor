// ram_widget_stable.ts
export async function main(ns: NS) {
	ns.disableLog("ALL")

	const doc = eval("document") as Document
	const widgetId = "ram-widget"

	const old = doc.getElementById(widgetId)
	if (old) old.remove()

	const box = doc.createElement("div")
	box.id = widgetId
	Object.assign(box.style, {
		position: "fixed",
		top: "8px",
		right: "240px",
		zIndex: "1500",
		background: "rgba(20,20,20,0.92)",
		color: "#00ff9c",
		padding: "12px 14px",
		border: "1px solid #00ff9c",
		borderRadius: "10px",
		fontFamily: "monospace",
		fontSize: "13px",
		whiteSpace: "pre",
		boxShadow: "0 0 12px rgba(0,255,156,0.25)",
		minWidth: "360px",
		cursor: "move",
		userSelect: "none",
	})
	doc.body.appendChild(box)

	// Close button
	const closeBtn = doc.createElement("div")
	closeBtn.innerText = "✖"
	Object.assign(closeBtn.style, {
		position: "absolute",
		top: "4px",
		right: "6px",
		cursor: "pointer",
		color: "#ff4b4b",
		fontSize: "19px",
		fontWeight: "bold",
		userSelect: "none",
	})
	box.appendChild(closeBtn)

	let running = true
	closeBtn.addEventListener("click", () => {
		box.remove()
		running = false
	})

	makeDraggable(box)

	// --- Header ---
	const title = doc.createElement("div")
	title.innerText = "RAM MONITOR"
	box.appendChild(title)

	const sep = doc.createElement("div")
	sep.innerText = "===================================="
	box.appendChild(sep)

	// --- Summary rows ---
	const createRow = (label: string) => {
		const div = doc.createElement("div")
		const span = doc.createElement("span")
		div.innerText = label
		div.appendChild(span)
		box.appendChild(div)
		return span
	}

	const homeBarSpan = createRow("HOME    ")
	const homeUsedSpan = createRow("        Used: ")
	const homeFreeSpan = createRow("        Free: ")
	const homeMax1Span = createRow("        MAX 1min: ")

	const totalBarSpan = createRow("TOTAL   ")
	const totalUsedSpan = createRow("        Used: ")
	const totalFreeSpan = createRow("        Free: ")
	const totalMax1Span = createRow("        MAX 1min: ")

	// --- Servers section ---
	const serversTitle = doc.createElement("div")
	serversTitle.innerText = "\nSERVERS"
	box.appendChild(serversTitle)

	const serversContainer = doc.createElement("div")
	Object.assign(serversContainer.style, {
		maxHeight: "260px",
		overflowY: "auto",
		overflowX: "hidden",
		paddingRight: "4px",
	})
	box.appendChild(serversContainer)

	type ServerRow = {
		div: HTMLDivElement
		nameSpan: HTMLSpanElement
		pctSpan: HTMLSpanElement
		ramSpan: HTMLSpanElement
		barSpan: HTMLSpanElement
	}

	const serverRows: Record<string, ServerRow> = {}

	// --- Rolling buffers ---
	const homeHistory: number[] = []
	const totalHistory: number[] = []

	try {
		while (running) {
			const discovered = getAllServers(ns)
			const orderedServers = sortServersStable(discovered)

			const homeMax = ns.getServerMaxRam("home")
			const homeUsed = ns.getServerUsedRam("home")
			const homeFree = homeMax - homeUsed

			const totalMax = orderedServers.reduce((sum, s) => sum + ns.getServerMaxRam(s), 0)
			const totalUsed = orderedServers.reduce((sum, s) => sum + ns.getServerUsedRam(s), 0)
			const totalFree = totalMax - totalUsed

			homeHistory.push(homeUsed)
			if (homeHistory.length > 60) homeHistory.shift()

			totalHistory.push(totalUsed)
			if (totalHistory.length > 60) totalHistory.shift()

			const homeMax1 = Math.max(...homeHistory)
			const totalMax1 = Math.max(...totalHistory)

			// --- Summary updates ---
			homeBarSpan.innerText = `${bar(homeUsed, homeMax)} ${pct(homeUsed, homeMax)}`
			homeUsedSpan.innerText = `${fmt(homeUsed)} / ${fmt(homeMax)}`
			homeFreeSpan.innerText = fmt(homeFree)
			homeMax1Span.innerText = fmt(homeMax1)

			totalBarSpan.innerText = `${bar(totalUsed, totalMax)} ${pct(totalUsed, totalMax)}`
			totalUsedSpan.innerText = `${fmt(totalUsed)} / ${fmt(totalMax)}`
			totalFreeSpan.innerText = fmt(totalFree)
			totalMax1Span.innerText = fmt(totalMax1)

			// --- Ensure rows exist in stable order ---
			for (const name of orderedServers) {
				const max = ns.getServerMaxRam(name)
				if (max <= 0) continue

				if (!serverRows[name]) {
					const row = createServerRow(name)
					serverRows[name] = row
					serversContainer.appendChild(row.div)
				}
			}

			// --- Update only dynamic text ---
			for (const name of orderedServers) {
				const max = ns.getServerMaxRam(name)
				if (max <= 0) continue

				const used = ns.getServerUsedRam(name)
				const row = serverRows[name]

				row.nameSpan.innerText = truncate(name, 18).padEnd(18)
				row.pctSpan.innerText = pct(used, max).padStart(6)
				row.ramSpan.innerText = `${fmtShort(used).padStart(7)} / ${fmtShort(max).padStart(7)}`
				row.barSpan.innerText = bar(used, max, 10)
			}

			await ns.sleep(1000)
		}
	} finally {
		const el = doc.getElementById(widgetId)
		if (el) el.remove()
	}

	function createServerRow(name: string): ServerRow {
		const div = doc.createElement("div")

		const nameSpan = doc.createElement("span")
		const pctSpan = doc.createElement("span")
		const ramSpan = doc.createElement("span")
		const barSpan = doc.createElement("span")

		div.appendChild(nameSpan)
		div.appendChild(doc.createTextNode(" "))
		div.appendChild(pctSpan)
		div.appendChild(doc.createTextNode(" "))
		div.appendChild(ramSpan)
		div.appendChild(doc.createTextNode(" "))
		div.appendChild(barSpan)

		nameSpan.innerText = truncate(name, 18).padEnd(18)
		pctSpan.innerText = "0.0%"
		ramSpan.innerText = "0.0GB / 0.0GB"
		barSpan.innerText = "[----------]"

		return { div, nameSpan, pctSpan, ramSpan, barSpan }
	}

	function sortServersStable(servers: string[]) {
		const withRam = servers.filter(s => ns.getServerMaxRam(s) > 0)

		const home = withRam.filter(s => s === "home")
		const pservs = withRam
			.filter(s => s.startsWith("pserv-"))
			.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

		const npc = withRam
			.filter(s => s !== "home" && !s.startsWith("pserv-"))
			.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

		return [...home, ...pservs, ...npc]
	}

	function makeDraggable(el: HTMLDivElement) {
		let isDragging = false
		let offsetX = 0
		let offsetY = 0

		el.addEventListener("mousedown", (e) => {
			if (e.target === closeBtn) return
			isDragging = true
			offsetX = e.clientX - el.offsetLeft
			offsetY = e.clientY - el.offsetTop
		})

		doc.addEventListener("mousemove", (e) => {
			if (!isDragging) return
			el.style.left = `${e.clientX - offsetX}px`
			el.style.top = `${e.clientY - offsetY}px`
			el.style.right = "auto"
		})

		doc.addEventListener("mouseup", () => {
			isDragging = false
		})
	}

	function getAllServers(ns: NS) {
		const visited: Set<string> = new Set()
		const queue: string[] = ["home"]

		while (queue.length > 0) {
			const server = queue.shift()!
			if (visited.has(server)) continue
			visited.add(server)

			for (const neighbor of ns.scan(server)) {
				if (!visited.has(neighbor)) queue.push(neighbor)
			}
		}

		return [...visited]
	}

	function fmt(ram: number) {
		return ns.format.ram(ram)
	}

	function fmtShort(ram: number) {
		return ns.format.ram(ram, 1)
	}

	function pct(used: number, max: number) {
		return ns.format.percent(used / (max + 1e-9), 1)
	}

	function truncate(str: string, len: number) {
		return str.length > len ? str.slice(0, len - 1) + "…" : str
	}

	function bar(used: number, max: number, width = 14) {
		if (max <= 0) return "[" + "-".repeat(width) + "]"
		const ratio = Math.min(1, used / max)
		const filled = Math.round(ratio * width)
		return "[" + "#".repeat(filled) + "-".repeat(width - filled) + "]"
	}
}
