const getRankData = (rank) => {
  if (rank === 0) {
    return { name: "Unranked" }
  }
  if (rank > 0 && rank <= 9) {
    return { icon: "♟", name: "Pawn", level: rank.toString() }
  }
  if (rank >= 10 && rank < 10 + 9) {
    return { icon: "♞", name: "Knight", level: (rank - 9).toString() }
  }
  if (rank >= 10 + 9 && rank < 10 + 9 + 9) {
    return { icon: "♝", name: "Bishop", level: (rank - 9 - 9).toString() }
  }
  if (rank >= 10 + 9 + 9 && rank < 10 + 9 + 9 + 9) {
    return { icon: "♜", name: "Rook", level: (rank - 9 - 9 - 9).toString() }
  }
  if (rank >= 10 + 9 + 9 + 9 && rank < 10 + 9 + 9 + 9 + 1) {
    return { icon: "♚", name: "King" }
  }
  if (rank >= 10 + 9 + 9 + 9 + 1) {
    return { icon: "♕", name: "Queen" }
  }
  // if (rank >= (10 + 9 + 9 + 9) && rank < (10 + 9 + 9 + 9 + 1)) { return "King-" + (rank - 9 - 9 - 9 - 9).toString(); }
  // if (rank >= (10 + 9 + 9 + 9 + 1)) { return "Queen-" + (rank - 9 - 9 - 9 - 9 - 1).toString(); }
  return "ERROR"
}

module.exports = getRankData