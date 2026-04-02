// ram_widget_full.ts
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
		minWidth: "280px",
		cursor: "move",
		userSelect: "none",
	})
	doc.body.appendChild(box)

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
	sep.innerText = "========================"
	box.appendChild(sep)

	// --- Home / Total RAM ---
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

	// --- TOP FREE SERVERS container ---
	const topTitle = doc.createElement("div")
	topTitle.innerText = "\nTOP FREE SERVERS"
	box.appendChild(topTitle)

	const topContainer = doc.createElement("div")
	Object.assign(topContainer.style, {
		maxHeight: "180px",
		overflowY: "auto",
	})
	box.appendChild(topContainer)

	// Map serverName -> row { nameSpan, freeSpan }
	const serverRows: Record<string, { div: HTMLDivElement; nameSpan: HTMLSpanElement; freeSpan: HTMLSpanElement }> = {}

	// --- Rolling buffers ---
	const homeHistory: number[] = []
	const totalHistory: number[] = []

	// --- Update loop ---
	while (running) {
		const servers = getAllServers(ns)

		const homeMax = ns.getServerMaxRam("home")
		const homeUsed = ns.getServerUsedRam("home")
		const homeFree = homeMax - homeUsed

		const totalMax = servers.reduce((sum, s) => sum + ns.getServerMaxRam(s), 0)
		const totalUsed = servers.reduce((sum, s) => sum + ns.getServerUsedRam(s), 0)
		const totalFree = totalMax - totalUsed

		homeHistory.push(homeUsed)
		if (homeHistory.length > 60) homeHistory.shift()
		totalHistory.push(totalUsed)
		if (totalHistory.length > 60) totalHistory.shift()

		const homeMax1 = Math.max(...homeHistory)
		const totalMax1 = Math.max(...totalHistory)

		// --- Update spans for home / total RAM ---
		homeBarSpan.innerText = bar(homeUsed, homeMax)
		homeUsedSpan.innerText = `${fmt(homeUsed)} / ${fmt(homeMax)}`
		homeFreeSpan.innerText = fmt(homeFree)
		homeMax1Span.innerText = fmt(homeMax1)

		totalBarSpan.innerText = bar(totalUsed, totalMax)
		totalUsedSpan.innerText = `${fmt(totalUsed)} / ${fmt(totalMax)}`
		totalFreeSpan.innerText = fmt(totalFree)
		totalMax1Span.innerText = fmt(totalMax1)

		// --- Update top servers ---
		const ranked = servers
			.map(s => ({
				name: s,
				max: ns.getServerMaxRam(s),
				used: ns.getServerUsedRam(s),
				free: ns.getServerMaxRam(s) - ns.getServerUsedRam(s),
			}))
			.filter(s => s.max > 0)
			.sort((a, b) => b.free - a.free)

		// Create new rows if server not yet in DOM
		for (const s of ranked) {
			if (!serverRows[s.name]) {
				const div = doc.createElement("div")
				const nameSpan = doc.createElement("span")
				const freeSpan = doc.createElement("span")
				Object.assign(freeSpan.style, { float: "right" })
				nameSpan.innerText = truncate(s.name, 14)
				freeSpan.innerText = fmtShort(s.free)
				div.appendChild(nameSpan)
				div.appendChild(freeSpan)
				topContainer.appendChild(div)
				serverRows[s.name] = { div, nameSpan, freeSpan }
			} else {
				serverRows[s.name].freeSpan.innerText = fmtShort(s.free)
			}
		}

		// Reorder DOM based on free RAM
		let prev: HTMLDivElement | null = null
		for (const s of ranked) {
			const row = serverRows[s.name].div
			if (prev === null) {
				topContainer.insertBefore(row, topContainer.firstChild)
			} else if (row !== prev.nextSibling) {
				topContainer.insertBefore(row, prev.nextSibling)
			}
			prev = row
		}

		await ns.sleep(1000)
	}

	// --- Helpers ---
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

	function truncate(str: string, len: number) {
		return str.length > len ? str.slice(0, len - 1) + "…" : str
	}

	function bar(used: number, max: number, width = 14) {
		if (max <= 0) return "[" + "-".repeat(width) + "]"
		const ratio = used / max
		const filled = Math.round(ratio * width)
		return "[" + "#".repeat(filled) + "-".repeat(width - filled) + "]"
	}
}
