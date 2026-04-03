/** auto_go_column.ts **/
/** @param {NS} ns **/
export async function main(ns: NS) {
	ns.disableLog("ALL")

	const MY = 1 // X
	const OPP = 2 // O
	const EMPTY = 0
	const DEAD = -1

	// Convert ns.go.getBoardState() (array of column strings) to numbers
	function boardToNumbers(columns: string[]): number[][] {
		const width = columns.length
		const height = columns[0].length
		const board: number[][] = Array.from({ length: width }, () => Array(height).fill(0))

		for (let x = 0; x < width; x++) {
			const col = columns[x]
			for (let y = 0; y < height; y++) {
				const c = col[y]
				if (c === "X") board[x][y] = MY
				else if (c === "O") board[x][y] = OPP
				else if (c === ".") board[x][y] = EMPTY
				else board[x][y] = DEAD
			}
		}
		return board
	}

	// Return all empty points (0)
	function getValidMoves(board: number[][]) {
		const moves: { x: number; y: number }[] = []
		for (let x = 0; x < board.length; x++) {
			for (let y = 0; y < board[x].length; y++) {
				if (board[x][y] === EMPTY) moves.push({ x, y })
			}
		}
		return moves
	}

	// Check rows, columns, and diagonals for 2-in-a-row to win or block
	function findCriticalMove(board: number[][], player: number) {
		const width = board.length
		const height = board[0].length

		// Rows (y fixed, x varies)
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width - 2; x++) {
				const line = [board[x][y], board[x + 1][y], board[x + 2][y]]
				if (line.filter(v => v === player).length === 2 && line.includes(EMPTY)) {
					return { x: x + line.indexOf(EMPTY), y }
				}
			}
		}

		// Columns (x fixed, y varies)
		for (let x = 0; x < width; x++) {
			for (let y = 0; y < height - 2; y++) {
				const line = [board[x][y], board[x][y + 1], board[x][y + 2]]
				if (line.filter(v => v === player).length === 2 && line.includes(EMPTY)) {
					return { x, y: y + line.indexOf(EMPTY) }
				}
			}
		}

		// Diagonals (\)
		for (let x = 0; x < width - 2; x++) {
			for (let y = 0; y < height - 2; y++) {
				const line = [board[x][y], board[x + 1][y + 1], board[x + 2][y + 2]]
				if (line.filter(v => v === player).length === 2 && line.includes(EMPTY)) {
					const i = line.indexOf(EMPTY)
					return { x: x + i, y: y + i }
				}
			}
		}

		// Anti-diagonals (/)
		for (let x = 2; x < width; x++) {
			for (let y = 0; y < height - 2; y++) {
				const line = [board[x][y], board[x - 1][y + 1], board[x - 2][y + 2]]
				if (line.filter(v => v === player).length === 2 && line.includes(EMPTY)) {
					const i = line.indexOf(EMPTY)
					return { x: x - i, y: y + i }
				}
			}
		}

		return null
	}

	while (true) {
		const rawBoard = ns.go.getBoardState() // array of column strings
		const board = boardToNumbers(rawBoard)

		// Try to win
		let move = findCriticalMove(board, MY)

		// Block opponent
		if (!move) move = findCriticalMove(board, OPP)

		// Otherwise pick first valid empty spot
		if (!move) {
			const moves = getValidMoves(board)
			if (moves.length === 0) break
			move = moves[0]
		}

		const r = await ns.go.makeMove(move.x, move.y)
		if (r.type == "gameOver") break
		await ns.sleep(50) // small delay
	}

	const gs = ns.go.getGameState()
	ns.tprint("Game over! Black Score: " + gs.blackScore)
	ns.tprint("White Score: " + gs.whiteScore)
}
