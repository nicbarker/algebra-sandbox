import React from "react";
import styles from "../styles/Home.module.css";
import { Fragment, useRef, useState } from "react";
import classnames from "classnames";
import katex from "katex";
import Link from "next/link";
import { AlgebraFunction, AlgebraFunctionType, CloneAlgebraFunction, ExecuteFunction, FunctionArguments, FunctionPrimitive, FunctionResult, PrintFunctionsLatex, PrintFunctionsLatexWithoutColors, PrintFunctionsWithoutColors, collapseTypeDocumentation } from "algebra/algebra";

// let equations: AlgebraFunction[] = [FunctionArguments(1, AlgebraFunctionType.DIV,
//   FunctionArguments(1, AlgebraFunctionType.ADD,
//     FunctionArguments(1, AlgebraFunctionType.EXPONENTIAL,
//       FunctionArguments(1, AlgebraFunctionType.ADD,
//         FunctionPrimitive(2),
//         FunctionPrimitive(1, 'dt')
//       ),
//       FunctionPrimitive(3)
//     ),
//     FunctionArguments(-1, AlgebraFunctionType.EXPONENTIAL,
//       FunctionPrimitive(2),
//       FunctionPrimitive(3)
//     )
//   ),
//   FunctionPrimitive(1, 'dt')
// ), FunctionArguments(1, AlgebraFunctionType.ADD,
//   FunctionPrimitive(2, 'x'),
//   FunctionPrimitive(5, 'x')
// )];

let equations: AlgebraFunction[] = [FunctionPrimitive(1)]


type AlgorithmSubStep = {
  functionBefore: AlgebraFunction,
  functionAfter: AlgebraFunction,
  result: FunctionResult
}

type AlgorithmStep = {
  operator: string,
  subSteps: AlgorithmSubStep[][],
  expanded?: boolean,
  state: AlgebraFunction[],
  stateAfterOperator: AlgebraFunction[]
}

function applyOperator(algebraFunction: AlgebraFunction) {
  const subSteps: AlgorithmSubStep[] = [];
  for (var i = 0; i < 1000; i++) {
    const functionBefore = CloneAlgebraFunction(algebraFunction);
    var result = ExecuteFunction(algebraFunction);
    algebraFunction = result.algebraFunction;
    if (!result.collapsed) {
      break;
    }
    const collapseType = result.functionCollapseInfo!.functionCollapseType;
    const collapseInfo = collapseTypeDocumentation[collapseType];
    if (!collapseInfo.internalOnly) {
      subSteps.push({
        functionBefore,
        functionAfter: CloneAlgebraFunction(result.algebraFunction),
        result
      });
    }
  }
  if (i === 999) {
    throw new Error("Infinite loop detected");
  }
  return {
    algebraFunction,
    subSteps
  }
}

let previousSteps: AlgorithmStep[] = [];

function PreviousToken(props: { step: AlgorithmStep, onClick?: () => void, onExpandSubTokens?: () => void }) {
  let hasSubSteps = false;
  const columns = props.step.state.map((expression, index) => {
    const tokens = PrintFunctionsLatexWithoutColors(expression);
    const leftString = katex.renderToString(tokens);
    const subTokens = (props.step.subSteps[index] || []).map((s, i) => {
      hasSubSteps = true;
      let stepText = "";
      if (s.result.collapsed && s.result.functionCollapseInfo) {
        let collapseType = s.result.functionCollapseInfo.functionCollapseType;
        stepText = collapseTypeDocumentation[collapseType].humanReadableMessage;
        if (s.result.functionCollapseInfo.additionalInfo) {
          stepText = stepText.replace("?", PrintFunctionsLatexWithoutColors(s.result.functionCollapseInfo.additionalInfo));
        }
      }
      return (<div className={styles.docItemOuter} key={i}>
        <div className={styles.docItemDescription}>{stepText}</div>
        <div className={styles.docItemBefore} dangerouslySetInnerHTML={{ __html: katex.renderToString(PrintFunctionsLatex(s.functionBefore, s.result.functionCollapseInfo!.beforeFunctionIds, s.result.functionCollapseInfo!.functionCollapseType, "red")) }} />
        <div className={styles.docItemAfter} dangerouslySetInnerHTML={{ __html: katex.renderToString(PrintFunctionsLatex(s.functionAfter, s.result.functionCollapseInfo!.afterFunctionIds, s.result.functionCollapseInfo!.functionCollapseType, "blue")) }} />
      </div>);
    });
    return <Fragment key={index}>
      <td className={classnames(styles.left, styles.grey)} onClick={props.onClick}>
        <div dangerouslySetInnerHTML={{ __html: leftString }} />
        {props.step.expanded && <div className={styles.docItems}>
          <div className={styles.docItemOuter}>
            <div className={styles.docItemDescription}>Apply {props.step.operator} to the expression</div>
            <div className={styles.docItemBefore} dangerouslySetInnerHTML={{ __html: katex.renderToString(PrintFunctionsLatex(props.step.stateAfterOperator[index], [], 1, "red")) }} />
          </div>
          {props.step.expanded && subTokens}
        </div>}
      </td >
      {index < props.step.state.length - 1 && <td className={styles.equals}>=</td>}
    </Fragment>
  });
  try {
    const rows = [<tr key={"result-row"}>
      {columns}
      <td className={classnames(styles.right, styles.grey)} dangerouslySetInnerHTML={{ __html: katex.renderToString(props.step.operator) }} />
    </tr >];
    if (hasSubSteps) {
      rows.push((
        <tr className={styles.expandSubTokens} onClick={props.onExpandSubTokens} key={"substeps-row"}>
          <td colSpan={equations.length * 2 - 1}>
            <div className={styles.expandSubTokensInternal}>
              <div className={styles.subTokenLine} />
              {props.step.expanded ? 'Hide Steps -' : 'Show Hidden Steps +'}
              <div className={styles.subTokenLine} />
            </div>
          </td>
        </tr>
      ))
    }
    return rows;
  } catch (error) {
    console.warn(error, props.step.state, props.step);
  }
}

function App() {
  const [currentInput, setCurrentInput] = useState<string>("");
  const [reload, setReload] = useState<number>(0);
  const [optionsExpanded, setOptionsExpanded] = useState(false);
  const [tokenStrings, setTokenStrings] = useState(equations.map(e => PrintFunctionsLatexWithoutColors(e)));
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

      const newStep: AlgorithmStep = {
        operator: currentInput,
        state: equations.map(e => CloneAlgebraFunction(e)),
        subSteps: [],
        stateAfterOperator: []
      };

      const operatorResults: {
        algebraFunction: AlgebraFunction;
        startingFunction?: AlgebraFunction;
        subSteps: AlgorithmSubStep[];
      }[] = [];
      for (let i = 0; i < equations.length; i++) {
        switch (currentInput[0]) {
          case "+": outerFunction = FunctionArguments(1, AlgebraFunctionType.ADD, equations[i]); break;
          case "-": outerFunction = FunctionArguments(1, AlgebraFunctionType.ADD, equations[i], FunctionArguments(1, AlgebraFunctionType.MUL, FunctionPrimitive(-1))); break;
          case "*": outerFunction = FunctionArguments(1, AlgebraFunctionType.MUL, equations[i]); break;
          case "/": outerFunction = FunctionArguments(1, AlgebraFunctionType.DIV, equations[i]); break;
          case "^": outerFunction = FunctionArguments(1, AlgebraFunctionType.EXPONENTIAL, equations[i]); break;
          case "s": {
            if (currentInput.includes("sqrt")) {
              outerFunction = FunctionArguments(1, AlgebraFunctionType.EXPONENTIAL, equations[i], FunctionArguments(1, AlgebraFunctionType.DIV, FunctionPrimitive(1), FunctionPrimitive(2)));
              const result = applyOperator(outerFunction);
              operatorResults.push({ ...result, startingFunction: outerFunction });
              continue;
            } else if (currentInput.includes("simplify")) {
              const result = applyOperator(equations[i]);
              operatorResults.push(result);
              continue;
            } else {
              throw new Error("Invalid operator");
            }
          }
          default: throw new Error("Need an operator for input");
        }
        let stringIndex = 1;
        let buildingFunction = FunctionPrimitive(0);
        while (stringIndex < currentInput.length) {
          if (currentInput[stringIndex].match(/[0-9]/)) {
            buildingFunction.quantity = parseInt(buildingFunction.quantity.toString() + currentInput[stringIndex], 10);
          } else {
            buildingFunction.symbol = currentInput[stringIndex];
            if (buildingFunction.quantity == 0) {
              buildingFunction.quantity = 1;
            }
          }
          stringIndex++;
        }
        if (outerFunction.arguments.length == 2) {
          outerFunction.arguments[1].arguments[1] = buildingFunction;
        } else {
          outerFunction.arguments[1] = buildingFunction;
        }
        const result = applyOperator(outerFunction);
        operatorResults.push({ ...result, startingFunction: outerFunction });
      }
      newStep.subSteps = operatorResults.map(r => r.subSteps);
      newStep.stateAfterOperator = operatorResults.map(r => r.startingFunction).filter((r): r is AlgebraFunction => !!r);
      previousSteps.push(newStep);
      equations = operatorResults.map(r => CloneAlgebraFunction(r.algebraFunction));
      setCurrentInput("");
      setTokenStrings(equations.map(e => PrintFunctionsLatexWithoutColors(e)));
      scrollTop();
      return;
    }
  }

  const previousTokens = previousSteps.map((s, i) => (
    <PreviousToken
      key={i}
      step={s}
      onClick={() => {
        equations = previousSteps[i].state;
        previousSteps = previousSteps.slice(0, i);
        setTokenStrings(equations.map(e => PrintFunctionsLatexWithoutColors(e)));
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
          <table className={styles.tokensOuter}>
            <tbody>
              {previousTokens}
              <tr>
                {tokenStrings.map((tokenString, index) => (
                  <Fragment key={index}>
                    <td className={styles.left} dangerouslySetInnerHTML={{ __html: katex.renderToString(tokenString) }} />
                    {index < tokenStrings.length - 1 && <td className={styles.equals}>=</td>}
                  </Fragment>
                ))}
                <td className={styles.right}>&#8592;</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className={styles.inputContainer}>
          <input autoFocus={true} placeholder={"Try something like \"+x\""} className={styles.inputIndicator} value={currentInput} onChange={(event) => setCurrentInput(event.target.value)} onKeyDown={onSubmit} />
          <button onClick={() => {
            equations.push(CloneAlgebraFunction(equations[equations.length - 1]));
            setTokenStrings(equations.map(e => PrintFunctionsLatexWithoutColors(e)));
          }}>Equality {"("}={")"}</button>
        </div>
      </div>
    </div>
  );
}

export default App;
