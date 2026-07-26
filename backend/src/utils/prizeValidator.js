const validateClaim = (prizeType, ticketMatrix, drawnNumbers, markedNumbers) => {
    const getRowNumbers = (rowIdx) => {
        return ticketMatrix[rowIdx].filter(n => n !== 0);
    };

    const allDrawnAndMarked = (numbers) => {
        return numbers.every(n => drawnNumbers.includes(n) && markedNumbers.includes(n));
    };

    switch (prizeType) {
        case 'Jaldi 5': {
            let matchedCount = 0;
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 9; c++) {
                    const num = ticketMatrix[r][c];
                    if (num !== 0 && drawnNumbers.includes(num) && markedNumbers.includes(num)) {
                        matchedCount++;
                    }
                }
            }
            return matchedCount >= 5;
        }
        case 'First Line': {
            return allDrawnAndMarked(getRowNumbers(0));
        }
        case 'Second Line': {
            return allDrawnAndMarked(getRowNumbers(1));
        }
        case 'Third Line': {
            return allDrawnAndMarked(getRowNumbers(2));
        }
        case 'Full House': {
            const allNumbers = [...getRowNumbers(0), ...getRowNumbers(1), ...getRowNumbers(2)];
            return allDrawnAndMarked(allNumbers);
        }
        default:
            return false;
    }
};

module.exports = { validateClaim };
