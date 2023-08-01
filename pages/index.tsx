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
    leftSubTree?: Token[],
    rightSubTree?: Token[]
}

const pathMapping: string[] = [
    'NONE',
    'ADD'
]

if (typeof window !== 'undefined') {
    window['pathMapping'] = pathMapping;
}

type NestedToken = { key: number, quantity: number, subTokens: NestedToken[] }
export function getPrintableTree(tokens: Token[]) {
    const printableTree: NestedToken = { key: getOrCreatePathMapping("NONE"), quantity: 0, subTokens: [] };
    const copy = JSON.parse(JSON.stringify(tokens)) as Token[];

    for (const token of copy) {
        let subTokens = printableTree.subTokens;
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
                case "LEFT":
                case "RIGHT":
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
            if (pathMapping[token.token.key] !== 'NONE' && (pathMapping[token.token.key] === 'NUMBER' || token.token.quantity !== 1)) {
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

function getPathSortOrder(path: string) {
    switch (path) {
        case 'NUMBER': return 1;
        case 'MUL': return 2;
        case 'ADD': return 3;
        default: return 0;
    }
}

function compareTokens(tokenA: Token, tokenB: Token) {
    for (let i = 0; i < tokenA.path.length && i < tokenB.path.length; i++) {
        if (tokenA.path[i] !== tokenB.path[i]) {
            return getPathSortOrder(pathMapping[tokenA.path[i]]) - getPathSortOrder(pathMapping[tokenB.path[i]]);
        }
    }
    return tokenA.path.length - tokenB.path.length;
}

function getPathHash(leaves: Token[], path: number[]) {
    let stringPath = path.join(',');
    let toHash = leaves.filter(t => t.path.slice(path.length).join(",").includes(stringPath));
    let hash: string = '';
    for (const token of toHash) {
        for (const segment of token.path) {
            hash += pathMapping[segment];
        }
    }
    return hash;
}

function process(leaves: Token[], basePath: number[]) {
    console.log("inspecting base path", basePath);
    let stringPath = JSON.stringify(basePath);
    let matched = leaves.filter(t => JSON.stringify(t.path.slice(0, basePath.length)) === stringPath);
    matched.sort(compareTokens);
    console.log("matched", JSON.parse(JSON.stringify(matched)));
    const group = basePath[basePath.length - 1];
    // Prune empty mul / add groups
    if (matched.length === 1 && (pathMapping[group] === "ADD" || pathMapping[group] === "MUL")) {
        console.log('prune', matched[0].path);
        matched[0].path.splice(basePath.length - 1, 1);
        return;
    }
    const mulCache: { [key: number]: number } = {};
    const diverged: number[][] = [];
    for (let i = 0; i < matched.length; i++) {
        if (matched[i].path[basePath.length - 1] !== group) { // The path has changed during this iteration and doesn't match the group any more
            const newPath = matched[i].path.slice(0, basePath.length + 1);
            if (matched[i].path.length > basePath.length + 1 && !diverged.find(p => JSON.stringify(p) === JSON.stringify(newPath))) {
                diverged.push(newPath);
            }
            continue;
        }
        let destroyed = false;
        for (let j = 0; j < matched.length; j++) {
            if (i === j) continue;
            if (pathMapping[matched[j].path[basePath.length]] === pathMapping[group]) { // hoist nested ADD & MUL
                matched[j].path.splice(basePath.length, 1);
                console.log(pathMapping[group], 'Hoist', JSON.parse(JSON.stringify(matched)));
            }
            const pathHash1 = getPathHash(matched, matched[i].path.slice(basePath.length));
            const pathHash2 = getPathHash(matched, matched[j].path.slice(basePath.length));
            switch (pathMapping[group]) {
                case 'ADD': {
                    if (pathHash1 && pathHash1 === pathHash2) {
                        matched[i].quantity += matched[j].quantity;
                        matched[j].path = [-1];
                        if (matched[i].quantity === 0) {
                            matched[i].path = [-1];
                        }
                    }
                    break;
                }
                case 'MUL': {
                    const leaf1 = matched[i].path[basePath.length];
                    const leaf2 = matched[j].path[basePath.length];
                    if (pathMapping[leaf2] === 'DIV') {
                        if (pathMapping[leaf1] === 'DIV') {
                            console.log("div div multiply");
                            console.log()
                            command(matched[j].leftSubTree, matched[i].leftSubTree, 'MUL');
                            command(matched[j].rightSubTree, matched[i].rightSubTree, 'MUL');
                        } else {
                            console.log("div any multiply");
                            command(matched[j].leftSubTree, [{ ...matched[i], path: matched[i].path.slice(basePath.length) }], 'MUL');
                        }
                        destroyed = true;
                    } // x * (x + 1) = x^2 + x
                    else if (pathMapping[leaf2] === 'ADD') { // Multiply out add
                        const cached = mulCache[matched[j].path[basePath.length + 1]] !== undefined;
                        const newMul = cached ? mulCache[matched[j].path[basePath.length + 1]] : createPathMapping("MUL");
                        matched[j].path.splice(basePath.length - 1, 1);
                        matched[j].path.splice(basePath.length, 0, newMul);
                        const clonedToken = { path: [...matched[j].path.slice(0, basePath.length + 1), ...matched[i].path.slice(basePath.length)], quantity: matched[i].quantity };
                        !cached && leaves.push(clonedToken);
                        mulCache[matched[j].path[basePath.length + 1]] = newMul;
                        console.log('Multiply out add', JSON.parse(JSON.stringify(matched)));
                        destroyed = true;
                    } // x * x^2 = x^3
                    else if (pathMapping[leaf1].length === 1 && pathMapping[leaf2] === 'POW' && pathMapping[matched[j].leftSubTree[0].path[0]] === pathMapping[leaf1]) {
                        command(matched[j].rightSubTree, [{ path: [getOrCreatePathMapping("NUMBER")], quantity: 1 }], 'ADD');
                        destroyed = true;
                    } // x * x = x^2
                    else if (pathMapping[leaf1].length === 1 && leaf1 === leaf2) {
                        const leaf = matched[i].path.splice(basePath.length, 1, createPathMapping("POW"))[0];
                        matched[i].quantity *= matched[j].quantity;
                        matched[i].leftSubTree = [{ path: [leaf], quantity: 1 }];
                        matched[i].rightSubTree = [{ path: [getOrCreatePathMapping("NUMBER")], quantity: 2 }];
                        matched[j].path = [-1];
                    } // x * 2 = 2x
                    else if (pathMapping[leaf2] === 'NUMBER' && pathMapping[leaf1] !== 'DIV') {
                        matched[i].quantity *= matched[j].quantity;
                        matched[j].path = [-1];
                    }
                    break;
                }
            }
        }
        const newPath = matched[i].path.slice(0, basePath.length + 1);
        if (destroyed) {
            matched[i].path = [-1];
            console.log('destroyed', JSON.parse(JSON.stringify(matched)));
        }
        else if (matched[i].path.length > basePath.length + 1 && !diverged.find(p => JSON.stringify(p) === JSON.stringify(newPath))) {
            diverged.push(newPath);
        }
    }
    console.log('cache', mulCache);
    for (const path of diverged) {
        process(leaves, path);
    }
}

export function command(leaves: Token[], newLeaves: Token[], operator: string) {
    switch (operator) {
        case 'ADD':
        case 'SUB':
        case 'MUL': {
            const baseGroup = getOrCreatePathMapping(operator === 'SUB' ? 'ADD' : operator);
            leaves.push(...newLeaves);
            leaves.forEach(t => t.path.splice(0, 0, baseGroup));
            process(leaves, []);
            break;
        }
        case 'DIV': {
            const baseGroup = getOrCreatePathMapping('MUL');
            const numerator = [{ path: [getOrCreatePathMapping("NUMBER")], quantity: 1 }];
            const denominator = newLeaves;
            leaves.push({
                path: [baseGroup, getOrCreatePathMapping('DIV')],
                quantity: 1,
                leftSubTree: numerator,
                rightSubTree: denominator
            });
            leaves.forEach(t => t.path.splice(0, 0, baseGroup));
            process(leaves, []);
        }
    }
    for (let i = 0; i < leaves.length; i++) {
        if (leaves[i].path[0] === -1) {
            console.log("Deleting old token", JSON.parse(JSON.stringify(leaves)));
            leaves.splice(i--, 1);
        }
    }
}

function applyOperator(input: InputOperatorObject) {
    previousSteps.push({
        operator: input,
        state: JSON.parse(JSON.stringify(equations))
    });
    const leaf = input.numeral ? getOrCreatePathMapping(input.numeral) : getOrCreatePathMapping('NUMBER');
    command(equations, [{ path: [leaf], quantity: input.value }], input.operator);
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
