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

type Value = { value: number | string, quantity: number };

type Token = {
    group: number,
    power: Value,
    mul: Value,
    div: Value,
    divPower: Value,
}

const pathMapping: string[] = [
    'NONE',
    'ADD'
]

if (typeof window !== 'undefined') {
    window['pathMapping'] = pathMapping;
}

let nextGroupId = 0;

function printValue(value: Value) {
    return value.value === 'NUMBER' ? value.quantity : `${value.quantity}${value.value}`;
}

function hasValue(value: Value) {
    return value.value !== 'NUMBER' || value.quantity !== 1;
}

export function printTokens(tokens: Token[]) {
    const copy = JSON.parse(JSON.stringify(tokens)) as Token[];
    copy.sort((a, b) => { return a.group - b.group });
    let output = '';

    for (let i = 0; i < copy.length; i++) {
        const token = copy[i];
        const hasDiv = token.div.value !== 'NUMBER' || token.div.quantity !== 1;
        const hasDivPower = token.divPower.value !== 'NUMBER' || token.divPower.quantity !== 1;
        const hasPower = token.power.value !== 'NUMBER' || token.power.quantity !== 1;
        output += hasValue(token.div) ? `{` : '';
        output += printValue(token.mul);
        output += hasValue(token.power) ? `^{${printValue(token.power)}}` : ''
        output += hasValue(token.div) ? ` \\over ${printValue(token.div)}` : ''
        output += hasValue(token.divPower) ? `^{${printValue(token.divPower)}}` : ''
        output += hasValue(token.div) ? `}` : ''
        output += (i < copy.length - 1 && copy[i + 1].group !== token.group) ? '+' : '';
    }
    return output;
}

function process(leaves: Token[]) {
    for (let i = 0; i < leaves.length; i++) {
        const leaf1 = leaves[i];
        for (let j = 0; j < leaves.length; j++) {
            if (i === j || leaves[i].mul.value === 'DESTROYED' || leaves[j].mul.value === 'DESTROYED') continue;
            const leaf2 = leaves[j];
            if (leaf1.group == leaf2.group) {
                // DIV
                if (hasValue(leaf2.div)) {
                    if (hasValue(leaf1.div)) {
                        if ((leaf1.div.value === leaf2.div.value || leaf1.div.value === "NUMBER" || leaf2.div.value === "NUMBER") &&
                            (leaf1.mul.value === leaf2.mul.value || leaf1.mul.value === "NUMBER" || leaf2.mul.value === "NUMBER")) {
                            console.log("SDF", leaf1, leaf2);
                            if (leaf2.div.value === 'NUMBER') { // NUMBER
                                leaf1.div.quantity *= leaf2.div.quantity;
                            }
                            else { //POW
                                leaf1.divPower.quantity += leaf2.divPower.quantity;
                            }
                            if (leaf2.mul.value === 'NUMBER') { // DIV NUMBER
                                leaf1.mul.quantity *= leaf2.mul.quantity;
                            }
                            else { // DIV POW
                                leaf1.power.quantity += leaf2.power.quantity;
                            }
                            leaf2.mul.value = 'DESTROYED';
                        } else {
                            console.log("TODO");
                        }
                    }
                    else if (leaf1.mul.value === "NUMBER" && leaf1.mul.value == leaf2.div.value) {
                        if (leaf1.mul.quantity / leaf2.div.quantity === Math.floor(leaf1.mul.quantity / leaf2.div.quantity)) {
                            leaf1.mul.quantity /= leaf2.div.quantity;
                        } else {
                            leaf1.div.quantity = leaf2.div.quantity;
                        }
                        leaf2.mul.value = 'DESTROYED';
                    } else if (leaf1.mul.value == leaf2.div.value) { // DIV X
                        leaf1.power.quantity -= leaf2.divPower.quantity;
                        if (leaf1.power.quantity === 0) {
                            leaf1.power.quantity = 1;
                            leaf1.mul.value = 'NUMBER';
                        }
                        leaf2.mul.value = 'DESTROYED';
                    } else if (leaf2.div.value !== 'NUMBER' || leaf2.div.quantity !== 1) {
                        console.log(leaf1.div.quantity, leaf2.div.quantity);
                        leaf1.div.value = leaf2.div.value;
                        leaf1.div.quantity *= leaf2.div.quantity;
                        leaf2.mul.value = 'DESTROYED';
                    }
                }
                else if (leaf2.mul.value === 'NUMBER') { // NUMBER
                    leaf1.mul.quantity *= leaf2.mul.quantity;
                    leaf2.mul.value = 'DESTROYED';
                }
                else if (leaf1.mul.value == leaf2.mul.value) { //POW
                    leaf1.power.quantity += leaf2.power.quantity;
                    leaf2.mul.value = 'DESTROYED';
                }
            }
        }
    }
    for (let i = 0; i < leaves.length; i++) {
        if (leaves[i].mul.value === "DESTROYED") {
            leaves.splice(i--, 1);
        }
    }
}

export function command(leaves: Token[], newLeaves: Token[], operator: string) {
    for (const token of newLeaves) {
        if (operator === 'ADD' || operator === 'SUB') {
            leaves.push(token);
        } else if (operator === 'MUL') {
            const oldLength = leaves.length;
            const cached = new Set<number>();
            for (let i = 0; i < oldLength; i++) {
                if (!cached.has(leaves[i].group)) {
                    const toAdd = JSON.parse(JSON.stringify(token));
                    toAdd.group = leaves[i].group;
                    leaves.push(toAdd);
                }
                cached.add(leaves[i].group);
            }
        } else if (operator === 'DIV') {
            const oldLength = leaves.length;
            for (let i = 0; i < oldLength; i++) {
                const toAdd = JSON.parse(JSON.stringify(token));
                toAdd.group = leaves[i].group;
                leaves.push(toAdd);
            }
        }
        console.log(JSON.parse(JSON.stringify(equations)));
        process(leaves);
    }
}

function applyOperator(input: InputOperatorObject) {
    previousSteps.push({
        operator: input,
        state: JSON.parse(JSON.stringify(equations))
    });
    const leaf = input.numeral || 'NUMBER';
    command(equations, [{
        group: nextGroupId++,
        power: { value: 'NUMBER', quantity: 1 },
        mul: input.operator !== InputOperator.DIVIDE ? { value: leaf, quantity: input.value } : { value: 'NUMBER', quantity: 1 },
        div: input.operator === InputOperator.DIVIDE ? { value: leaf, quantity: input.value } : { value: 'NUMBER', quantity: 1 },
        divPower: { value: 'NUMBER', quantity: 1 }
    }], input.operator);
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
