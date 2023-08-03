import React from "react";
import styles from "../styles/Home.module.css";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import classnames from "classnames";
import katex from "katex";
import Link from "next/link";
import classNames from "classnames";
import { Token, cloneTokenWithGroup, command, incrementAndReturnGroupId, printTokens } from "./algebra";

let equations: Token[] = [{
    group: 0,
    numerator: {
        pow: { value: "NUMBER", quantity: 1 },
        base: { value: "NUMBER", quantity: 1 }
    },
    denominator: {
        pow: { value: "NUMBER", quantity: 1 },
        base: { value: "NUMBER", quantity: 1 }
    },
}];

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

function applyOperator(input: InputOperatorObject) {
    previousSteps.push({
        operator: input,
        state: JSON.parse(JSON.stringify(equations))
    });
    if (input.operator === 'POW') {
        const originalEquations = JSON.parse(JSON.stringify(equations));
        for (let i = 1; i < input.value; i++) {
            incrementAndReturnGroupId(1);
            equations = command(equations, originalEquations.map(t => cloneTokenWithGroup(t, t.group + incrementAndReturnGroupId(0))), 'MUL');
        }
        return;
    }
    const leaf = input.numeral || 'NUMBER';
    equations = command(equations, [{
        group: incrementAndReturnGroupId(1),
        numerator: {
            pow: { value: 'NUMBER', quantity: 1 },
            base: input.operator !== InputOperator.DIVIDE ? { value: leaf, quantity: input.value } : { value: 'NUMBER', quantity: 1 },
        },
        denominator: {
            pow: { value: 'NUMBER', quantity: 1 },
            base: input.operator === InputOperator.DIVIDE ? { value: leaf, quantity: input.value } : { value: 'NUMBER', quantity: 1 },
        }
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
    const [tokenString, setTokenString] = useState(printTokens(equations));
    const scrollRef = useRef<HTMLDivElement>(null);

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
                            applyOperator(currentInput);
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
