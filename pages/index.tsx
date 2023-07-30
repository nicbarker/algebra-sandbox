import React from "react";
import styles from "../styles/Home.module.css";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import classnames from "classnames";
import katex from "katex";
import Link from "next/link";
import classNames from "classnames";

const DEBUG_VIEW = true;

let equations: Token[] = [];

type StepNote = {
    groupId: number,
    noteStart: number,
    noteEnd: number,
    // noteContentsToken?: TokenGroupAdd,
    noteContentsText?: string
}

type AlgorithmStep = {
    operator: InputOperatorObject,
    subSteps?: AlgorithmStep[],
    expanded?: boolean,
    state: Token[],
    note?: StepNote,
    cancellations?: number[]
}

type Token = {
    path: number[],
    quantity: number,
    leftSubTree?: Token[]
    rightSubTree?: Token[]
}

const pathMapping: string[] = [
    'ADD'
]

if (typeof window !== 'undefined') {
    window['pathMapping'] = pathMapping;
}

function leafToken(token: Token) {
    return pathMapping[token.path[token.path.length - 1]];
}

function groupToken(token: Token) {
    return pathMapping[token.path[token.path.length - 2]];
}

type NestedToken = { key: number, quantity: number, subTokens: NestedToken[] }
export function getPrintableTree(tokens: Token[]) {
    const printableTree: NestedToken = { key: tokens.length > 0 ? tokens[0].path[0] : 0, quantity: 1, subTokens: [] };
    const copy = JSON.parse(JSON.stringify(tokens)) as Token[];

    for (const token of copy) {
        let subTokens = [printableTree];
        while (token.path.length > 0) {
            let pathSegment = token.path.splice(0, 1)[0];
            const matchingToken = subTokens.find(t => t.key === pathSegment);
            if (!matchingToken) {
                const newToken = {
                    key: pathSegment,
                    quantity: 1,
                    subTokens: []
                };
                subTokens.push(newToken);
                if (token.path.length === 0) {
                    newToken.quantity = token.quantity;
                    switch (pathMapping[pathSegment]) {
                        case "DIV":
                        case "POW": {
                            newToken.subTokens.push(getPrintableTree(token.leftSubTree));
                            newToken.subTokens.push(getPrintableTree(token.rightSubTree));
                            break;
                        }
                    }
                }
                subTokens = newToken.subTokens;
            } else {
                subTokens = matchingToken.subTokens;
            }
        }
    }
    return printableTree;
}

type PrintableToken = {
    type: 'token',
    token: NestedToken
} | {
    type: 'string',
    string: string
}

function printTokens(tokens: Token[]) {
    const printable = getPrintableTree(tokens);
    console.log(printable);
    let outputString = '';
    const toPrint: PrintableToken[] = [{ type: 'token', token: printable }];
    while (toPrint.length > 0) {
        const token = toPrint.splice(toPrint.length - 1, 1)[0];
        if (token.type === 'string') {
            outputString += token.string;
        } else {
            switch (pathMapping[token.token.key]) {
                case "NONE":
                case "MUL": {
                    for (let i = token.token.subTokens.length - 1; i > -1; i--) {
                        toPrint.push({ type: 'token', token: token.token.subTokens[i] });
                    }
                    break;
                }
                case "ADD": {
                    for (let i = token.token.subTokens.length - 1; i > -1; i--) {
                        toPrint.push({ type: 'token', token: token.token.subTokens[i] });
                        toPrint.push({ type: 'string', string: "+" });
                    }
                    toPrint.splice(toPrint.length - 1, 1);
                    break;
                }
                case "POW": {
                    toPrint.push({ type: 'string', string: '}' });
                    toPrint.push({ type: 'token', token: token.token.subTokens[1] });
                    toPrint.push({ type: 'string', string: '^{' });
                    toPrint.push({ type: 'token', token: token.token.subTokens[0] });
                    break;
                }
                case "DIV": {
                    toPrint.push({ type: 'string', string: '}' });
                    toPrint.push({ type: 'token', token: token.token.subTokens[1] });
                    toPrint.push({ type: 'string', string: ' \\over ' });
                    toPrint.push({ type: 'token', token: token.token.subTokens[0] });
                    toPrint.push({ type: 'string', string: '{' });
                    break;
                }
                case "NUMBER": break;
                default: {
                    toPrint.push({ type: 'string', string: pathMapping[token.token.key] });
                    break;
                }
            }
            if (pathMapping[token.token.key] === 'NUMBER' || token.token.quantity !== 1) {
                toPrint.push({ type: 'string', string: token.token.quantity === -1 ? '-' : token.token.quantity.toString() });
            }
        }
    }
    console.log(outputString);
    return outputString;
}

function createPathMapping(path: string) {
    pathMapping.push(path);
    return pathMapping.length - 1;
}

function getOrCreatePathMapping(path: string) {
    const index = pathMapping.findIndex(v => v === path);
    if (index === -1) {
        pathMapping.push(path);
        return pathMapping.length - 1;
    } else {
        return index;
    }
}

export function command(leaves: Token[], operator: string, path: string, quantity: number) {
    commandInternal(leaves, operator, [path], quantity);
}

// Returns TRUE the result was a "clean" add or division
export function commandInternalWillProduceCleanResult(leaves: Token[], operator: string, pathString: string[]): boolean {
    const path = getOrCreatePathMapping(pathString[0]);
    switch (operator) {
        case 'ADD': {
            return leaves.findIndex(l => l.path[1] == path) !== -1;
        }
        case 'MUL': {
            return true;
        }
        case 'DIV': {
            const toModify: { index: number, token: Token }[] = []
            for (let i = 0; i < leaves.length; i++) {
                const token = leaves[i];
                // Only multiply / div into a mul group once
                if (groupToken(token) === "MUL") {
                    const otherTokenInGroupIndex = toModify.findIndex(t => t.token.path[t.token.path.length - 2] === token.path[token.path.length - 2]);
                    if (otherTokenInGroupIndex === -1) {
                        toModify.push({ index: i, token });
                    } else if (
                        (leafToken(toModify[otherTokenInGroupIndex].token) !== 'NUMBER' &&
                            path === token.path[token.path.length - 1])
                        ||
                        (leafToken(token) === 'POW' &&
                            JSON.stringify(token.leftSubTree[0].path) === JSON.stringify([0, path]))) {
                        toModify[otherTokenInGroupIndex] = { token, index: i };
                    }
                } else {
                    toModify.push({ index: i, token });
                }
            }
            for (let i = 0; i < toModify.length; i++) {
                const token = toModify[i].token;
                if (operator === 'DIV') {
                    const leaf = leafToken(token);
                    if (pathMapping[path] === 'NUMBER' && leaf !== 'DIV') {
                        continue;
                    } else if (leaf === 'POW' && JSON.stringify(token.leftSubTree[0].path) === JSON.stringify([0, path])) {
                        continue;
                    } else if (leaf === 'DIV') {
                        continue;
                    } else if (leaf.length === 1 && leaf === pathMapping[path]) {
                        continue;
                    } else if (leaf.length === 1 && leaf === pathMapping[path]) {
                        continue;
                    }

                    return false;
                }
            }
            return true;
        }
    }
}

export function commandInternal(leaves: Token[], operator: string, pathString: string[], quantity: number): boolean {
    const path = getOrCreatePathMapping(pathString[0]);
    switch (operator) {
        case 'ADD': {
            for (let i = 0; i < leaves.length; i++) {
                const leaf1 = leaves[i];
                if (leaf1.path[1] == path) {
                    leaf1.quantity += quantity;
                    if (leaf1.quantity === 0) {
                        leaves.splice(i, 1);
                    }
                    return true;
                }
            }
            leaves.push({
                path: [0, path],
                quantity
            });
        }
        case 'DIV':
        case 'MUL': {
            const toMultiply: Token[] = []
            for (let i = 0; i < leaves.length; i++) {
                const token = leaves[i];
                // Only multiply / div into a mul group once
                if (groupToken(token) === "MUL") {
                    const otherTokenInGroupIndex = toMultiply.findIndex(t => t.path[t.path.length - 2] === token.path[token.path.length - 2]);
                    if (otherTokenInGroupIndex === -1) {
                        toMultiply.push(token);
                    } else if (
                        (leafToken(toMultiply[otherTokenInGroupIndex]) !== 'NUMBER' &&
                            path === token.path[token.path.length - 1])
                        ||
                        (leafToken(token) === 'POW' &&
                            JSON.stringify(token.leftSubTree[0].path) === JSON.stringify([0, path]))) {
                        toMultiply[otherTokenInGroupIndex] = token;
                    }
                } else {
                    toMultiply.push(token);
                }
            }
            for (let i = 0; i < toMultiply.length; i++) {
                const token = toMultiply[i];
                console.log(operator, leafToken(token), quantity);
                if (operator === 'MUL') {
                    if (pathMapping[path] === 'NUMBER' && leafToken(token) !== 'DIV') {
                        token.quantity *= quantity;
                        continue;
                    }
                    switch (leafToken(token)) {
                        case "NUMBER": {
                            token.quantity *= quantity;
                            token.path[token.path.length - 1] = path;
                            break;
                        }
                        case 'DIV': {
                            if (commandInternalWillProduceCleanResult(token.rightSubTree, 'DIV', [pathMapping[path]])) {
                                commandInternal(token.rightSubTree, 'DIV', [pathMapping[path]], quantity);
                                if (pathMapping[token.rightSubTree[0].path[1]] === "NUMBER" && token.rightSubTree[0].quantity === 1) { // DIV has hit x/1
                                    token.path.splice(-1, 1);
                                    token.leftSubTree.forEach(t => t.path = token.path.concat(t.path.slice(1)));
                                    leaves.splice(leaves.indexOf(toMultiply[i]), 1);
                                }
                            } else {
                                command(token.leftSubTree, 'MUL', pathMapping[path], quantity);
                            }
                            break;
                        }
                        case 'POW': {
                            token.quantity *= quantity;
                            if (JSON.stringify(token.leftSubTree[0].path) === JSON.stringify([0, path])) {
                                command(token.rightSubTree, 'ADD', 'NUMBER', 1);
                                break;
                            }
                        }
                        default: { // pronumerals
                            token.quantity *= quantity;
                            // Same pronumeral, upgrade to POW
                            if (leafToken(token) === pathMapping[path]) {
                                const powBase = token.path.splice(-1, 1)[0];
                                token.path.push(createPathMapping('POW'));
                                token.leftSubTree = [{
                                    path: [0, powBase],
                                    quantity: 1
                                }];
                                token.rightSubTree = [{
                                    path: [0, getOrCreatePathMapping('NUMBER')],
                                    quantity: 2
                                }];
                            } else {
                                // Different pronumeral, create MUL group
                                if (groupToken(token) !== 'MUL') {
                                    const newMapping = createPathMapping("MUL");
                                    token.path.splice(token.path.length - 1, 0, newMapping);
                                }
                                leaves.push({
                                    path: token.path.slice(0, -1).concat([path]),
                                    quantity: 1
                                });
                            }
                        }
                    }
                } else if (operator === 'DIV') {
                    const isCleanDivision = token.quantity / quantity === Math.floor(token.quantity / quantity);
                    if (isCleanDivision) {
                        token.quantity /= quantity;
                        if (pathMapping[path] === 'NUMBER') {
                            continue;
                        }
                    }
                    const leaf = leafToken(token);
                    if (leaf === 'POW') {
                        if (JSON.stringify(token.leftSubTree[0].path) === JSON.stringify([0, path])) {
                            command(token.rightSubTree, 'ADD', 'NUMBER', -1)
                            if (token.rightSubTree.length === 0) { // POW has hit x^0
                                token.path[token.path.length - 1] = getOrCreatePathMapping("NUMBER");
                                token.quantity = 1;
                            } else if (pathMapping[token.rightSubTree[0].path[1]] === "NUMBER" && token.rightSubTree[0].quantity === 1) { // POW has hit x^1
                                token.path[token.path.length - 1] = token.leftSubTree[0].path[1] // TODO composite bases need to be merged back out of subtree
                            }
                            continue;
                        }
                    } else if (leaf === 'DIV') {
                        if (commandInternalWillProduceCleanResult(token.leftSubTree, 'DIV', [pathMapping[path]])) {
                            command(token.leftSubTree, 'DIV', pathMapping[path], quantity);
                        } else {
                            command(token.rightSubTree, 'MUL', pathMapping[path], quantity);
                        }
                        continue;
                    } else if (leaf.length === 1 && leaf === pathMapping[path]) {
                        if (groupToken(token) === "MUL") {
                            leaves.splice(leaves.indexOf(toMultiply[i]), 1);
                        } else {
                            token.path[token.path.length - 1] = getOrCreatePathMapping('NUMBER');
                        }
                        continue;
                    }

                    // Fallback: upgrade to DIV
                    const divGroup: Token = {
                        path: token.path.slice(0, -1).concat(createPathMapping('DIV')),
                        quantity: 1,
                        leftSubTree: [],
                        rightSubTree: [{
                            path: [0, path],
                            quantity: quantity
                        }],
                    };

                    const group = token.path[token.path.length - 2];
                    // If we're dividing a multiply group, bring the whole group into the DIV numerator
                    if (groupToken(token) === "MUL") {
                        const newMul = createPathMapping("MUL");
                        for (let j = 0; j < leaves.length; j++) {
                            const leaf = leaves[j];
                            if (group === leaf.path[leaf.path.length - 2]) {
                                divGroup.leftSubTree.push({
                                    path: [0, newMul, leaf.path[leaf.path.length - 1]],
                                    quantity: leaf.quantity,
                                    leftSubTree: leaf.leftSubTree,
                                    rightSubTree: leaf.rightSubTree
                                })
                                leaves.splice(j, 1);
                                j--;
                            }
                        }
                    } else {
                        // Otherwise, just bring the single token into the numerator
                        token.path = [0, token.path[token.path.length - 1]];
                        divGroup.leftSubTree[0] = token;
                        leaves.splice(leaves.findIndex(t => t === token), 1);
                    }
                    leaves.push(divGroup);
                }
            }
            console.log(JSON.parse(JSON.stringify(leaves)));
        }
    }
}

const getGCD = (x: number, y: number): number => (!y ? x : getGCD(y, x % y));

function getOperatorLabel(operator: InputOperatorObject) {
    let value;
    if (operator.numeral || operator.value) {
        value = ` ${operator.numeral || Math.abs(operator.value!)}`;
    } else {
        value = ''
    }
    switch (operator.operator) {
        case InputOperator.ADD: return `+${value}`;
        case InputOperator.SUBTRACT: return `-${value}`;
        case InputOperator.MULTIPLY: return `\\times${value}`;
        case InputOperator.DIVIDE: return `/${value}`;
        case InputOperator.EXPONENT: return `()^${value}`;
        case InputOperator.SIMPLIFY: return 'simplify';
    }
}

let previousSteps: AlgorithmStep[] = [];

enum InputOperator {
    NONE = "NONE",
    ADD = "ADD",
    SUBTRACT = "SUB",
    MULTIPLY = "MUL",
    DIVIDE = "DIV",
    EXPONENT = "POW",
    SIMPLIFY = "SIMP"
}

type InputOperatorObject = {
    operator: InputOperator,
    numeral?: string;
    value?: number;
}

function getInputLabelFromOperator(operatorObject: InputOperatorObject) {
    let toReturn = '';
    switch (operatorObject.operator) {
        case InputOperator.NONE: return 'Try typing +2, -x, *y etc';
        case InputOperator.ADD: toReturn += '+ '; break;
        case InputOperator.SUBTRACT: toReturn += '- '; break;
        case InputOperator.MULTIPLY: toReturn += '*\ '; break;
        case InputOperator.DIVIDE: toReturn += '/ '; break;
        case InputOperator.EXPONENT: toReturn += '^ '; break;
        case InputOperator.SIMPLIFY: toReturn += 'simplify'; break;
    }
    if (!operatorObject.value && !operatorObject.numeral) {
        toReturn += '{number or pronumeral}';
    } else if (operatorObject.numeral) {
        toReturn += operatorObject.numeral;
    } else if (operatorObject.value) {
        toReturn += Math.abs(operatorObject.value).toString();
    }
    return toReturn;
}

function PreviousToken(props: { step: AlgorithmStep, onClick?: () => void, onExpandSubTokens?: () => void }) {
    return useMemo(() => {
        process.env.NODE_ENV === 'development' && console.log("recompute");
        const tokens = printTokens(props.step.state);
        try {
            const leftString = katex.renderToString(tokens);
            const subTokens = (props.step.subSteps || []).map((s, i) => (
                <PreviousToken key={i} step={s}></PreviousToken>
            ));
            return <Fragment>
                <div className={classnames(styles.left, styles.grey)} onClick={props.onClick} dangerouslySetInnerHTML={{ __html: leftString }} />
                <div className={classnames(styles.right, styles.grey)} dangerouslySetInnerHTML={{ __html: katex.renderToString(getOperatorLabel(props.step.operator)) }} />
                {subTokens.length > 0 && <div className={styles.expandSubTokens} onClick={props.onExpandSubTokens}>
                    <div className={styles.subTokenLine} />
                    {props.step.expanded ? 'Hide Steps -' : 'Show Hidden Steps +'}
                    <div className={styles.subTokenLine} />
                </div>}
                {props.step.expanded && subTokens}
            </Fragment >
        } catch (error) {
            console.warn(error, tokens, props.step);
        }
    }, [props.step, props.step.expanded]);
}

function applyOperator(input: InputOperatorObject) {
    previousSteps.push({
        operator: input,
        state: JSON.parse(JSON.stringify(equations))
    });
    command(equations, input.operator === 'SUB' ? 'ADD' : input.operator, input.numeral || 'NUMBER', input.value);
}

function App() {
    const [currentInput, setCurrentInput] = useState<InputOperatorObject>({ operator: InputOperator.NONE });
    const [reload, setReload] = useState<number>(0);
    const [optionsExpanded, setOptionsExpanded] = useState(false);
    const [tokenString, setTokenString] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    // useEffect(() => {
    //   window['Module']._initialize();
    //   setTokenString(window['Module'].UTF8ToString(window['Module']._getTokenString()));
    // }, []);

    useEffect(() => {
        const down = (event: KeyboardEvent) => {
            let handled = false;
            if (currentInput.operator !== InputOperator.NONE) {
                if (event.key.match(/[1-9]/)) {
                    currentInput.value = parseInt(event.key, 10) * (currentInput.operator === InputOperator.SUBTRACT ? -1 : 1);
                    currentInput.numeral = undefined;
                    handled = true;
                }
                else if (event.key.match(/[a-z]/) && event.key.length === 1) {
                    currentInput.numeral = event.key;
                    currentInput.value = currentInput.operator === InputOperator.SUBTRACT ? -1 : +1;
                    handled = true;
                }
            }
            switch (event.key) {
                case '+': currentInput.operator = InputOperator.ADD; handled = true; break;
                case '-': currentInput.operator = InputOperator.SUBTRACT; handled = true; break;
                case '*': currentInput.operator = InputOperator.MULTIPLY; handled = true; break;
                case '/': currentInput.operator = InputOperator.DIVIDE; handled = true; break;
                case '^': currentInput.operator = InputOperator.EXPONENT; handled = true; break;
                case 'u': currentInput.operator = InputOperator.SIMPLIFY; currentInput.numeral = '\.'; handled = true; break;
                case 'Escape':
                case 'Backspace': {
                    setCurrentInput({ operator: InputOperator.NONE });
                    handled = true;
                    break;
                }
                case 'Enter': {
                    if (currentInput.operator !== InputOperator.NONE) {
                        if (currentInput.value || currentInput.numeral) {
                            console.log(currentInput);
                            applyOperator(currentInput);
                            console.log(JSON.parse(JSON.stringify(equations)));
                            setTokenString(printTokens(equations));
                            handled = true;
                            setTimeout(() => {
                                if (scrollRef.current) {
                                    scrollRef.current.scrollTop = 10000;
                                }
                            })
                        }
                        setCurrentInput({ operator: InputOperator.NONE });
                        handled = true;
                    }
                }
            }
            if (handled) {
                event.preventDefault();
                setReload(reload + 1);
            }
        }
        const up = (key: KeyboardEvent) => {
            // switch (key.key) {
            //   case 'a': leftHeld = false; break;
            //   case 'd': rightHeld = false; break;
            // }
        };
        document.addEventListener('keydown', down)
        document.addEventListener('keyup', up);

        return () => {
            document.removeEventListener('keydown', down);
            document.removeEventListener('keyup', up);
        }

    }, [reload, currentInput]);

    const previousTokens = previousSteps.map((s, i) => (
        <PreviousToken
            key={i}
            step={s}
            onClick={() => {
                equations = previousSteps[i].state;
                previousSteps = previousSteps.slice(0, i);
                setReload(reload + 1)
            }}
            onExpandSubTokens={() => {
                s.expanded = !s.expanded;
                setReload(reload + 1);
            }}
        ></PreviousToken>
    ));
    // const tokens = equations.map(equation => {
    //   return TokenGroupComponent({ group: equation, noParens: true, algorithmStep: { operator: { operator: InputOperator.NONE }, state: equations, subSteps: [] } }).join(' ');
    // }).join(' = ');
    return (
        <div className={styles.App} role="main">
            <div className={styles.container}>
                <div className={styles.headerBar}>
                    <div className={styles.logo}>Algebra Sandbox</div>
                    <div className={styles.dropdownOuter}>
                        <div className={styles.dropdownLabel} onClick={() => setOptionsExpanded(!optionsExpanded)}>Options &#8595;</div>
                        <button className={classNames(styles.dropdownInner, { [styles.visible]: optionsExpanded })}>
                            <label>
                                Equality Count
                                <div className={styles.expand} />
                                <select onChange={(event) => {
                                    const newValue = parseInt(event.target.value, 10);
                                    if (newValue > equations.length) {
                                        for (let i = equations.length; i < newValue; i++) {
                                            // equations.push({ type: TokenType.GROUP_ADD, id: nextTokenId++, tokens: [{ type: TokenType.PRIMITIVE_NUMBER, id: nextTokenId++, value: 1 }] });
                                        }
                                    } else if (newValue < equations.length) {
                                        equations = equations.slice(0, newValue);
                                    }
                                    setReload(reload + 1);
                                }}>
                                    <option value={1}>1</option>
                                    <option value={2}>2</option>
                                    <option value={3}>3</option>
                                </select>
                            </label>
                        </button>
                    </div>
                    <div className={styles.expand} />
                    <Link href="https://github.com/nicbarker/algebra-sandbox">
                        GitHub
                    </Link>
                </div>
                <div className={styles.tokenScrollContainer} ref={scrollRef}>
                    <div className={styles.tokensOuter}>
                        {previousTokens}
                        <div className={styles.left} dangerouslySetInnerHTML={{ __html: katex.renderToString(tokenString) }} />
                        <div className={styles.right}>&#8592;</div>
                    </div>
                </div>
                <div className={styles.inputIndicator}>
                    {getInputLabelFromOperator(currentInput)}
                </div>
            </div>
        </div>
    );
}

export default App;
