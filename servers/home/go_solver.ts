export async function main(ns: NS) {
	const bs = ns.go.getBoardState()
	ns.tprintRaw(bs.join("\n"))
	const bs2 = convertBoard(bs)
	const moves = getValidMoves(bs2)
	ns.tprint(moves)
}

function getValidMoves(board: number[][]): { x: number, y: number }[] {
	const moves = []
	for (let y = 0; y < board.length; y++) {
		for (let x = 0; x < board[y].length; x++) {
			if (board[y][x] === 0) {
				moves.push({ x, y })
			}
		}
	}
	return moves
}

function convertBoard(inBoard: string[]): number[][] {
	const outBoard: number[][] = inBoard.map(() => [])
	for (let x = 0; x < inBoard.length; x++) {
		const row = inBoard[x]
		for (let y = 0; y < row.length; y++) {
			const pos = row[y]
			if (pos === ".") {
				outBoard[x][y] = 0
			} else if (pos === "#") {
				outBoard[x][y] = -1
			} else if (pos === "X") {
				outBoard[x][y] = 1
			} else if (pos === "O") {
				outBoard[x][y] = 2
			} else {
				throw new Error("sup:" + pos)
			}
		}
	}
	return outBoard
}
