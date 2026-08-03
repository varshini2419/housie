const validateClaim = (prizeType, ticketMatrix, drawnNumbers, markedNumbers = []) => {
    if (!ticketMatrix || !Array.isArray(ticketMatrix) || ticketMatrix.length < 3) {
        return false;
    }
    if (!drawnNumbers || !Array.isArray(drawnNumbers)) {
        return false;
    }

    const getRowNumbers = (rowIdx) => {
        if (!ticketMatrix[rowIdx]) return [];
        return ticketMatrix[rowIdx].filter(n => n !== 0);
    };

    // A number is valid if it has been drawn by the game engine
    const isDrawn = (n) => drawnNumbers.includes(n);

    const allDrawn = (numbers) => {
        return numbers.length > 0 && numbers.every(n => isDrawn(n));
    };

    const normalized = (prizeType || '').toString().replace(/\s+/g, '').toLowerCase();

    switch (normalized) {
        case 'jaldi5':
        case 'early5':
        case 'earlyfive': {
            let matchedCount = 0;
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 9; c++) {
                    const num = ticketMatrix[r][c];
                    if (num !== 0 && isDrawn(num)) {
                        matchedCount++;
                    }
                }
            }
            return matchedCount >= 5;
        }
        case 'earlyseven':
        case 'jaldi7': {
            let matchedCount = 0;
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 9; c++) {
                    const num = ticketMatrix[r][c];
                    if (num !== 0 && isDrawn(num)) {
                        matchedCount++;
                    }
                }
            }
            return matchedCount >= 7;
        }
        case 'fourcorners': {
            const top = getRowNumbers(0);
            const bottom = getRowNumbers(2);
            if (top.length < 2 || bottom.length < 2) return false;
            const corners = [top[0], top[top.length - 1], bottom[0], bottom[bottom.length - 1]];
            return allDrawn(corners);
        }
        case 'firstline':
        case 'topline':
        case 'line1': {
            return allDrawn(getRowNumbers(0));
        }
        case 'secondline':
        case 'middleline':
        case 'line2': {
            return allDrawn(getRowNumbers(1));
        }
        case 'thirdline':
        case 'bottomline':
        case 'lastline':
        case 'line3': {
            return allDrawn(getRowNumbers(2));
        }
        case 'fullhouse':
        case 'housie': {
            const allNumbers = [...getRowNumbers(0), ...getRowNumbers(1), ...getRowNumbers(2)];
            return allDrawn(allNumbers);
        }
        default: {
            // Flexible fallback for custom or unmapped prize names
            if (normalized.includes('jaldi5') || normalized.includes('early5')) {
                let count = 0;
                for (let r = 0; r < 3; r++) {
                    for (let c = 0; c < 9; c++) {
                        if (ticketMatrix[r][c] !== 0 && isDrawn(ticketMatrix[r][c])) count++;
                    }
                }
                return count >= 5;
            }
            if (normalized.includes('first') || normalized.includes('top')) return allDrawn(getRowNumbers(0));
            if (normalized.includes('second') || normalized.includes('middle')) return allDrawn(getRowNumbers(1));
            if (normalized.includes('third') || normalized.includes('bottom') || normalized.includes('last')) return allDrawn(getRowNumbers(2));
            if (normalized.includes('full') || normalized.includes('housie')) {
                const allNums = [...getRowNumbers(0), ...getRowNumbers(1), ...getRowNumbers(2)];
                return allDrawn(allNums);
            }
            return false;
        }
    }
};

module.exports = { validateClaim };
