const validateClaim = (prizeType, ticketMatrix, drawnNumbers, markedNumbers) => {
    const getRowNumbers = (rowIdx) => {
        return ticketMatrix[rowIdx].filter(n => n !== 0);
    };

    const allDrawnAndMarked = (numbers) => {
        return numbers.every(n => drawnNumbers.includes(n) && markedNumbers.includes(n));
    };

    switch (prizeType) {
        case 'Jaldi5': {
            let matchedCount = 0;
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 9; c++) {
                    const num = ticketMatrix[r][c];
                    if (num !== 0 && drawnNumbers.includes(num) && markedNumbers.includes(num)) {
                        matchedCount++;
                    }
                }
            }
            // Early Five: first player with at least 5 marked drawn numbers (not exactly 5)
            return matchedCount >= 5;
        }
        case 'EarlySeven': {
            let matchedCount = 0;
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 9; c++) {
                    const num = ticketMatrix[r][c];
                    if (num !== 0 && drawnNumbers.includes(num) && markedNumbers.includes(num)) {
                        matchedCount++;
                    }
                }
            }
            return matchedCount >= 7;
        }
        case 'FourCorners':
        case 'Four Corners': {
            const top = getRowNumbers(0);
            const bottom = getRowNumbers(2);
            if (top.length < 2 || bottom.length < 2) return false;
            const corners = [top[0], top[top.length - 1], bottom[0], bottom[bottom.length - 1]];
            return allDrawnAndMarked(corners);
        }
        case 'SixCorners':
        case 'Six Corners':
        case '6 Corners': {
            const top = getRowNumbers(0);
            const middle = getRowNumbers(1);
            const bottom = getRowNumbers(2);
            if (top.length < 2 || middle.length < 2 || bottom.length < 2) return false;
            const corners = [
                top[0], top[top.length - 1],
                middle[0], middle[middle.length - 1],
                bottom[0], bottom[bottom.length - 1]
            ];
            return allDrawnAndMarked(corners);
        }
        case 'MiddleNumber':
        case 'Middle Number': {
            const middleRow = getRowNumbers(1);
            if (middleRow.length < 3) return false;
            const middleNum = middleRow[2]; // 3rd number in second row
            return allDrawnAndMarked([middleNum]);
        }
        case 'FirstLine':
        case 'TopLine': {
            return allDrawnAndMarked(getRowNumbers(0));
        }
        case 'SecondLine':
        case 'MiddleLine': {
            return allDrawnAndMarked(getRowNumbers(1));
        }
        case 'ThirdLine':
        case 'BottomLine': {
            return allDrawnAndMarked(getRowNumbers(2));
        }
        case 'FullHouse': {
            const allNumbers = [...getRowNumbers(0), ...getRowNumbers(1), ...getRowNumbers(2)];
            return allDrawnAndMarked(allNumbers);
        }
        default:
            return false;
    }
};

module.exports = { validateClaim };
