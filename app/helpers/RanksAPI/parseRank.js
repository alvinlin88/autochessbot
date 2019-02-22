const parseRank = rankInput => {
  let stripped = rankInput.toLowerCase().replace(/\W+/g, "")
  let rankStr = stripped.replace(/[0-9]/g, "")
  let rankNum = stripped.replace(/[a-z]/g, "")

  let mappings = { pawn: 0, knight: 1, bishop: 2, rook: 3, king: 4, queen: 5 }

  if (rankStr === "king") return 37
  if (rankStr === "queen") return 38

  if (rankNum < 1 || rankNum > 9) {
    return null
  }
  if (!mappings.hasOwnProperty(rankStr)) {
    return null
  }

  let rank = 0

  rank = rank + mappings[rankStr] * 9
  rank = rank + parseInt(rankNum)

  return rank
}

module.exports = parseRank
