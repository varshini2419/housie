const generateTicket = () => {
    let grid;
    while (true) {
        grid = Array.from({ length: 3 }, () => Array(9).fill(false));
        for (let r = 0; r < 3; r++) {
            let cols = [0, 1, 2, 3, 4, 5, 6, 7, 8];
            for (let i = cols.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [cols[i], cols[j]] = [cols[j], cols[i]];
            }
            for (let i = 0; i < 5; i++) {
                grid[r][cols[i]] = true;
            }
        }

        let valid = true;
        for (let c = 0; c < 9; c++) {
            let count = 0;
            for (let r = 0; r < 3; r++) {
                if (grid[r][c]) count++;
            }
            if (count === 0) valid = false;
        }
        if (valid) break;
    }

    const ranges = [
        { min: 1, max: 9 },
        { min: 10, max: 19 },
        { min: 20, max: 29 },
        { min: 30, max: 39 },
        { min: 40, max: 49 },
        { min: 50, max: 59 },
        { min: 60, max: 69 },
        { min: 70, max: 79 },
        { min: 80, max: 90 }
    ];

    const ticketMatrix = Array.from({ length: 3 }, () => Array(9).fill(0));

    for (let c = 0; c < 9; c++) {
        let count = 0;
        for (let r = 0; r < 3; r++) {
            if (grid[r][c]) count++;
        }

        if (count > 0) {
            let nums = new Set();
            while (nums.size < count) {
                nums.add(Math.floor(Math.random() * (ranges[c].max - ranges[c].min + 1)) + ranges[c].min);
            }
            nums = Array.from(nums).sort((a, b) => a - b);

            let numIdx = 0;
            for (let r = 0; r < 3; r++) {
                if (grid[r][c]) {
                    ticketMatrix[r][c] = nums[numIdx++];
                }
            }
        }
    }
    return ticketMatrix;
};

const generateUniqueCode = (existingCodes) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    while (true) {
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (!existingCodes.has(code)) {
            existingCodes.add(code);
            return code;
        }
    }
};

const generateBatch = (count) => {
    const tickets = [];
    const signatures = new Set();
    const codes = new Set();

    while (tickets.length < count) {
        const matrix = generateTicket();
        const signature = matrix.map(row => row.join(',')).join('|');
        
        if (!signatures.has(signature)) {
            signatures.add(signature);
            const code = generateUniqueCode(codes);
            tickets.push({
                ticketCode: code,
                ticketMatrix: matrix
            });
        }
    }
    return tickets;
};

module.exports = { generateBatch };
