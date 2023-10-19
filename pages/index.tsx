import React from "react";
import styles from "../styles/Home.module.css";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import classnames from "classnames";
import katex from "katex";
import Link from "next/link";
import { AlgebraFunction, AlgebraFunctionType, AlgebraSymbol, AlgebraSymbolFromChar, ExecuteFunction, FunctionArguments, FunctionPrimitive, PrintFunctionsLatex } from "algebra/algebra";

let equations: AlgebraFunction = FunctionArguments(1, AlgebraFunctionType.EXPONENTIAL,
  FunctionPrimitive(1, AlgebraSymbol.X),
  FunctionArguments(1, AlgebraFunctionType.DIV,
    FunctionPrimitive(1),
    FunctionPrimitive(2)
  )
);

type StepNote = {
  groupId: number,
  noteStart: number,
  noteEnd: number,
  // noteContentsToken?: TokenGroupAdd,
  noteContentsText?: string
}

type AlgorithmStep = {
  operator: string,
  subSteps?: AlgorithmStep[],
  expanded?: boolean,
  state: AlgebraFunction,
  note?: StepNote,
  cancellations?: number[]
}

function applyOperator(inputString: string, algebraFunction: AlgebraFunction) {
  previousSteps.push({
    operator: "← " + inputString,
    state: JSON.parse(JSON.stringify(equations))
  });
  for (var i = 0; i < 1000; i++) {
    var result = ExecuteFunction(algebraFunction);
    if (!result.collapsed) {
      equations = result.algebraFunction;
      return;
    }
    algebraFunction = result.algebraFunction;
  }
  throw new Error("Infinite loop detected");
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

function PreviousToken(props: { step: AlgorithmStep, onClick?: () => void, onExpandSubTokens?: () => void }) {
  return useMemo(() => {
    const tokens = PrintFunctionsLatex(props.step.state);
    try {
      const leftString = katex.renderToString(tokens);
      const subTokens = (props.step.subSteps || []).map((s, i) => (
        <PreviousToken key={i} step={s}></PreviousToken>
      ));
      return <Fragment>
        <div className={classnames(styles.left, styles.grey)} onClick={props.onClick} dangerouslySetInnerHTML={{ __html: leftString }} />
        <div className={classnames(styles.right, styles.grey)} dangerouslySetInnerHTML={{ __html: katex.renderToString(props.step.operator) }} />
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
  const [currentInput, setCurrentInput] = useState<string>("");
  const [reload, setReload] = useState<number>(0);
  const [optionsExpanded, setOptionsExpanded] = useState(false);
  const [tokenString, setTokenString] = useState(PrintFunctionsLatex(equations));
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollTop() {
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 10000;
    }, 0)
  }

  const onSubmit = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      let outerFunction: AlgebraFunction | undefined;
      if (currentInput == "") return;
      switch (currentInput[0]) {
        case "+": outerFunction = FunctionArguments(1, AlgebraFunctionType.ADD, equations); break;
        case "-": outerFunction = FunctionArguments(1, AlgebraFunctionType.ADD, equations, FunctionArguments(1, AlgebraFunctionType.MUL, FunctionPrimitive(-1))); break;
        case "*": outerFunction = FunctionArguments(1, AlgebraFunctionType.MUL, equations); break;
        case "/": outerFunction = FunctionArguments(1, AlgebraFunctionType.DIV, equations); break;
        case "^": outerFunction = FunctionArguments(1, AlgebraFunctionType.EXPONENTIAL, equations); break;
        case "s": {
          if (currentInput.includes("sqrt")) {
            applyOperator(currentInput, FunctionArguments(1, AlgebraFunctionType.EXPONENTIAL, equations, FunctionArguments(1, AlgebraFunctionType.DIV, FunctionPrimitive(1), FunctionPrimitive(2))));
            setCurrentInput("");
            setTokenString(PrintFunctionsLatex(equations));
            scrollTop();
            return;
          } else {
            throw new Error("Invalid operator");
          }
        }
        default: throw new Error("Need an operator for input");
      }
      let stringIndex = 1;
      let buildingFunction = FunctionPrimitive(0);
      while (stringIndex < currentInput.length) {
        console.log(currentInput[stringIndex]);
        if (currentInput[stringIndex].match(/[0-9]/)) {
          buildingFunction.quantity = parseInt(buildingFunction.quantity.toString() + currentInput[stringIndex], 10);
        } else if (currentInput[stringIndex].match(/[A-Za-z]/)) {
          buildingFunction.symbol = AlgebraSymbolFromChar(currentInput[stringIndex])
          if (buildingFunction.quantity == 0) {
            buildingFunction.quantity = 1;
          }
          console.log(buildingFunction);
        }
        stringIndex++;
      }
      if (outerFunction.arguments.length == 2) {
        outerFunction.arguments[1].arguments[1] = buildingFunction;
      } else {
        outerFunction.arguments[1] = buildingFunction;
      }
      applyOperator(currentInput, outerFunction);
      setCurrentInput("");
      setTokenString(PrintFunctionsLatex(equations));
      scrollTop();
    }
  }

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
        <input autoFocus={true} placeholder={"Try something like \"+x\""} className={styles.inputIndicator} value={currentInput} onChange={(event) => setCurrentInput(event.target.value)} onKeyDown={onSubmit} />
      </div>
    </div>
  );
}

export default App;
