export async function main(ns: NS) {
	ns.disableLog("ALL")

	const doc = eval("document") as Document
	const widgetId = "ram-widget"

	// Remove old widget if already running
	const old = doc.getElementById(widgetId)
	if (old) old.remove()

	// Create widget
	const box = doc.createElement("div")
	box.id = widgetId
	box.style.position = "fixed"
	box.style.top = "80px"
	box.style.right = "20px"
	box.style.zIndex = "999999"
	box.style.background = "rgba(20,20,20,0.92)"
	box.style.color = "#00ff9c"
	box.style.padding = "12px 14px"
	box.style.border = "1px solid #00ff9c"
	box.style.borderRadius = "10px"
	box.style.fontFamily = "monospace"
	box.style.fontSize = "13px"
	box.style.whiteSpace = "pre"
	box.style.boxShadow = "0 0 12px rgba(0,255,156,0.25)"
	box.style.minWidth = "280px"
	box.style.cursor = "move"
	box.style.userSelect = "none"

	box.innerText = "Loading RAM..."
	doc.body.appendChild(box)

	// Close button
	const closeBtn = doc.createElement("div")
	closeBtn.innerText = "✖"
	closeBtn.style.position = "absolute"
	closeBtn.style.top = "4px"
	closeBtn.style.right = "6px"
	closeBtn.style.cursor = "pointer"
	closeBtn.style.color = "#ff4b4b"
	closeBtn.style.fontWeight = "bold"
	closeBtn.style.userSelect = "none"
	box.appendChild(closeBtn)

	closeBtn.addEventListener("click", () => {
		box.remove()
		running = false // stop the update loop
	})

	// Drag support
	makeDraggable(box)

	// Rolling buffers for max RAM over last 60 seconds
	const homeHistory = []
	const totalHistory = []

	let running = true

	try {
		while (running) {
			const servers = getAllServers(ns)

			const homeMax = ns.getServerMaxRam("home")
			const homeUsed = ns.getServerUsedRam("home")
			const homeFree = homeMax - homeUsed

			const totalMax = servers.reduce((sum, s) => sum + ns.getServerMaxRam(s), 0)
			const totalUsed = servers.reduce((sum, s) => sum + ns.getServerUsedRam(s), 0)
			const totalFree = totalMax - totalUsed

			// Update rolling history
			homeHistory.push(homeUsed)
			if (homeHistory.length > 60) homeHistory.shift()

			totalHistory.push(totalUsed)
			if (totalHistory.length > 60) totalHistory.shift()

			const homeMax1min = Math.max(...homeHistory)
			const totalMax1min = Math.max(...totalHistory)

			const ranked = servers
				.map(s => ({
					name: s,
					max: ns.getServerMaxRam(s),
					used: ns.getServerUsedRam(s),
					free: ns.getServerMaxRam(s) - ns.getServerUsedRam(s)
				}))
				.filter(s => s.max > 0)
				.sort((a, b) => b.free - a.free)
				.slice(0, 8)

			let text = ""
			text += "RAM MONITOR\n"
			text += "========================\n"
			text += `HOME    ${bar(homeUsed, homeMax)}\n`
			text += `        ${fmt(homeUsed)} / ${fmt(homeMax)}\n`
			text += `        FREE: ${fmt(homeFree)}\n\n`
			text += `        MAX 1min: ${fmt(homeMax1min)}\n\n`

			text += `TOTAL   ${bar(totalUsed, totalMax)}\n`
			text += `        ${fmt(totalUsed)} / ${fmt(totalMax)}\n`
			text += `        FREE: ${fmt(totalFree)}\n\n`
			text += `        MAX 1min: ${fmt(totalMax1min)}\n\n`

			text += "TOP FREE SERVERS\n"
			text += "------------------------\n"
			for (const s of ranked) {
				text += `${truncate(s.name, 14).padEnd(14)} ${fmtShort(s.free).padStart(7)}\n`
			}

			box.innerText = text
			box.appendChild(closeBtn)

			await ns.sleep(1000)
		}
	} finally {
		const el = doc.getElementById(widgetId)
		if (el) el.remove()
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
