type Token = {
    path: string[],
    quantity: number,
    leftSubTree?: Token[]
    rightSubTree?: Token[]
}

const allLeaves: Token[][] = [[]];

function leafToken(token: Token) {
    return token.path[token.path.length - 1];
}

function groupToken(token: Token) {
    return token.path[token.path.length - 2];
}

export function getPrintableTree(tokens: Token[]) {
    const printableTree: any = {}
    const copy = JSON.parse(JSON.stringify(tokens)) as Token[];

    for (const token of copy) {
        let subTreeLevel = printableTree;
        while (token.path.length > 0) {
            let pathSegment = token.path.splice(0, 1)[0];
            if (!subTreeLevel[pathSegment]) {
                subTreeLevel[pathSegment] = {};
                if (token.path.length === 0) {
                    switch (pathSegment) {
                        case "POW": {
                            subTreeLevel[pathSegment]['QUANTITY'] = token.quantity;
                            subTreeLevel[pathSegment]['BASE'] = getPrintableTree(token.leftSubTree);
                            subTreeLevel[pathSegment]['EXPONENT'] = getPrintableTree(token.rightSubTree);
                            break;
                        }
                        case "NUMBER":
                        default: {
                            subTreeLevel[pathSegment] = token.quantity; break;
                        }
                    }
                }
            }
            subTreeLevel = subTreeLevel[pathSegment];
        }
    }
    return printableTree;
}

function printTokens(tokens: Token[]) {
    const printable = getPrintableTree(tokens);
    let outputString = '';
    const toPrint: any[] = [{ type: 'token', tokenType: "NONE", token: printable }];
    while (toPrint.length > 0) {
        const token = toPrint.splice(toPrint.length - 1, 1)[0];
        if (token.type === 'string') {
            outputString += token.string;
        } else {
            switch (token.tokenType) {
                case "NONE": {
                    for (const key of Object.keys(token.token)) {
                        toPrint.push({ type: 'token', tokenType: key, token: token.token[key] });
                    }
                    break;
                }
                case "ADD": {
                    for (const key of Object.keys(token.token)) {
                        toPrint.push({ type: 'token', tokenType: key, token: token.token[key] });
                        toPrint.push({ type: 'string', string: "+" });
                    }
                    toPrint.splice(toPrint.length - 1, 1);
                    break;
                }
                case "POW": {
                    toPrint.push({ type: 'string', string: '}' });
                    toPrint.push({ type: 'token', tokenType: 'ADD', token: token.token['EXPONENT']['ADD'] });
                    toPrint.push({ type: 'string', string: '^{' });
                    toPrint.push({ type: 'token', tokenType: 'ADD', token: token.token['BASE']['ADD'] });
                    toPrint.push({ type: 'string', string: token.token['QUANTITY'] });
                    break;
                }
                case "NUMBER":
                    {
                        if (parseInt(token.token, 10) < 0) {
                            toPrint.splice(toPrint.length - 1, 1);
                        }
                        toPrint.push({ type: 'string', string: token.token });
                        break;
                    }
                default: {
                    if (parseInt(token.token, 10) < 0) {
                        toPrint.splice(toPrint.length - 1, 1);
                    }
                    toPrint.push({ type: 'string', string: (parseInt(token.token, 10) === 1 ? '' : token.token) + token.tokenType });
                    break;
                }
            }
        }
    }
    return outputString;
}

export function command(leaves: Token[], operator: string, path: string, quantity: number): boolean {
    if (commandInternal(leaves, operator, [path], quantity)) {
        simplify(leaves);
        return true;
    }
    return false;
}

export function commandInternal(leaves: Token[], operator: string, pathString: string[], quantity: number): boolean {
    const path = pathString[0]
    switch (operator) {
        case 'ADD': {
            console.log("Adding", quantity, path);
            leaves.push({
                path: ['ADD', path],
                quantity
            });
            return true;
        }
        case 'MUL': {
            console.log("Multiplying", quantity, path);
            if (path === 'NUMBER') {
                for (let i = 0; i < leaves.length; i++) {
                    leaves[i].quantity *= quantity;
                }
                return true;
            } else { // Pronumeral
                const oldLength = leaves.length;
                for (let i = 0; i < oldLength; i++) {
                    switch (leafToken(leaves[i])) {
                        case "NUMBER": {
                            leaves[i].path[leaves[i].path.length - 1] = path;
                            leaves[i].quantity *= quantity;
                            break;
                        }
                        case 'POW': {
                            if (leaves[i].leftSubTree.length === 1 && leaves[i].leftSubTree.find(l => JSON.stringify(l.path) === JSON.stringify(['ADD', path]))) {
                                command(leaves[i].rightSubTree, 'ADD', 'NUMBER', 1);
                                break;
                            };
                        }
                        default: { // pronumerals
                            leaves[i].path.splice(leaves[i].path.length - 1, 0, 'MUL');
                            leaves.push({
                                path: leaves[i].path.slice(0, -1).concat([path]),
                                quantity: quantity
                            });
                            break;
                        }
                    }
                }
                return true;
            }
        }
    }
}

export function simplify(leaves: Token[]) {
    let maxDepth = 0;
    for (let i = 0; i < leaves.length; i++) {
        const leaf1 = leaves[i];
        maxDepth = Math.max(maxDepth, leaf1.path.length);
        for (let j = i + 1; j < leaves.length; j++) {
            const leaf2 = leaves[j];
            // memcmp;
            if (JSON.stringify(leaf1.path) == JSON.stringify(leaf2.path)) {
                const isNumber = leafToken(leaf1) === 'NUMBER';
                switch (groupToken(leaf1)) {
                    case 'ADD': {
                        leaf1.quantity += leaf2.quantity;
                        leaves.splice(j, 1);
                        j--;
                        if (leaf1.quantity === 0) {
                            leaves.splice(i, 1);
                            i--;
                        }
                        break;
                    }
                    case 'MUL': {
                        leaf1.quantity *= leaf2.quantity;
                        leaf2.quantity = 1;
                        if (!isNumber) {
                            leaf1.path = leaf1.path.slice(0, -2).concat(['POW']);
                            leaf1.leftSubTree = [
                                {
                                    path: ['ADD', leafToken(leaf2)],
                                    quantity: 1
                                },
                            ];
                            leaf1.rightSubTree = [
                                {
                                    path: ['ADD', 'NUMBER'],
                                    quantity: 2
                                },
                            ];
                        }
                        leaves.splice(j, 1);
                        j--;
                        break;
                    }
                }
            }
        }
    }
}

console.log("---------------------------------------------------");
command(allLeaves[0], 'ADD', 'NUMBER', 2);
printTokens(allLeaves[0]);
command(allLeaves[0], 'ADD', 'NUMBER', -3);
printTokens(allLeaves[0]);
command(allLeaves[0], 'ADD', 'x', -3);
printTokens(allLeaves[0]);
command(allLeaves[0], 'ADD', 'x', 1);
printTokens(allLeaves[0]);
command(allLeaves[0], 'MUL', 'x', -3);
printTokens(allLeaves[0]);
command(allLeaves[0], 'ADD', 'x', -3);
printTokens(allLeaves[0]);
command(allLeaves[0], 'MUL', 'x', 1);
printTokens(allLeaves[0]);
command(allLeaves[0], 'ADD', 'y', 2);
printTokens(allLeaves[0]);