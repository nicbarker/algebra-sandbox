import React from "react";
import styles from "../styles/Home.module.css";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import classnames from "classnames";
import katex from "katex";
import Link from "next/link";
import classNames from "classnames";
import Script from "next/script";

const DEBUG_VIEW = true;

let nextTokenId = 0;

enum TokenType {
  PRIMITIVE_NUMBER = 'primitive_number',
  PRIMITIVE_PRONUMERAL = 'primitive_pronumeral',
  GROUP_ADD = 'add',
  GROUP_MUL = 'mul',
  GROUP_DIV = 'div',
  GROUP_POW = 'pow',
  GROUP_ROOT = 'root'
}

type TokenGroupAdd = {
  type: TokenType.GROUP_ADD,
  id: number,
  tokens: Token[],
}

type TokenGroupMul = {
  type: TokenType.GROUP_MUL,
  id: number,
  tokens: Token[],
}

type TokenGroupDiv = {
  type: TokenType.GROUP_DIV,
  numerator: TokenGroupAdd,
  denominator: TokenGroupAdd,
}

type TokenGroupPow = {
  type: TokenType.GROUP_POW,
  base: TokenGroupAdd,
  exponent: TokenGroupAdd
}

type TokenGroup = TokenGroupAdd | TokenGroupMul | TokenGroupDiv | TokenGroupPow;

type TokenPrimitiveNumber = {
  type: TokenType.PRIMITIVE_NUMBER,
  id: number,
  value: number
}

type TokenPrimitivePronumeral = {
  type: TokenType.PRIMITIVE_PRONUMERAL,
  id: number,
  numeral: string
}

type TokenPrimitive = TokenPrimitiveNumber | TokenPrimitivePronumeral;

type Token = TokenGroup | TokenPrimitive;

let equations: TokenGroupAdd[] = [
  {
    type: TokenType.GROUP_ADD,
    id: nextTokenId++,
    tokens: [
      // {
      //   type: TokenType.GROUP_MUL,
      //   tokens: [
      //     { type: TokenType.PRIMITIVE_NUMBER, value: 6 },
      //     {
      //       type: TokenType.GROUP_POW,
      //       base: {
      //         type: TokenType.GROUP_ADD,
      //         tokens: [
      //           { type: TokenType.PRIMITIVE_PRONUMERAL, numeral: 'y' }
      //         ]
      //       },
      //       exponent: {
      //         type: TokenType.GROUP_ADD,
      //         tokens: [
      //           { type: TokenType.PRIMITIVE_NUMBER, value: 2 }
      //         ]
      //       },
      //     },
      //     { type: TokenType.PRIMITIVE_PRONUMERAL, numeral: 'x' }
      //   ]
      // },
      // {
      //   type: TokenType.GROUP_POW,
      //   base: {
      //     type: TokenType.GROUP_ADD,
      //     tokens: [
      // { type: TokenType.PRIMITIVE_PRONUMERAL, numeral: 'x' },
      { type: TokenType.PRIMITIVE_NUMBER, id: nextTokenId++, value: 1 }
      //     ]
      //   },
      //   exponent: {
      //     type: TokenType.GROUP_ADD,
      //     tokens: [
      //       { type: TokenType.PRIMITIVE_NUMBER, value: 2 }
      //     ]
      //   },
      // },
    ],
  }
];

type StepNote = {
  groupId: number,
  noteStart: number,
  noteEnd: number,
  noteContentsToken?: TokenGroupAdd,
  noteContentsText?: string
}

type AlgorithmStep = {
  operator: InputOperatorObject,
  subSteps?: AlgorithmStep[],
  expanded?: boolean,
  state: TokenGroupAdd[],
  note?: StepNote,
  cancellations?: number[]
}

function isGroupToken(token: Token): token is TokenGroup {
  return ![TokenType.PRIMITIVE_NUMBER, TokenType.PRIMITIVE_PRONUMERAL].includes(token.type);
}

function getSignOfTokenGroup(token: TokenGroup) {
  let toInspect: Token = token;
  while (true) {
    if (toInspect.type === TokenType.GROUP_MUL || toInspect.type === TokenType.GROUP_ADD) {
      toInspect = toInspect.tokens[0]
    } else if (toInspect.type === TokenType.PRIMITIVE_NUMBER) {
      return toInspect.value < 0 ? '-' : '+';
    } else {
      return '+';
    }
  }
}

function TokenGroupComponent(props: { group: TokenGroup, noParens?: boolean, algorithmStep: AlgorithmStep }): string[] {
  console.log('group');
  const { group, noParens, algorithmStep } = props;
  let toReturn: string[] = [];
  if (group.type === TokenType.GROUP_ADD || group.type === TokenType.GROUP_MUL) {
    const parens = group.tokens.length > 1 && !noParens && group.type === TokenType.GROUP_ADD;
    const note = algorithmStep.note && algorithmStep.note.groupId === group.id ? algorithmStep.note : undefined;
    if (parens) toReturn.push('(')
    for (let i = 0; i < group.tokens.length; i++) {
      const token = group.tokens[i];
      if (token.type === TokenType.PRIMITIVE_NUMBER) {
        if (DEBUG_VIEW && group.type === TokenType.GROUP_MUL && i > 0) {
          toReturn.push('\\cdot');
        }
        if ((group.type !== TokenType.GROUP_MUL && i > 0) || token.value < 0) {
          toReturn.push(token.value >= 0 ? '+' : '-');
        }
        if (note && note.noteStart === i) {
          toReturn.push("\\overbrace{");
        }
        toReturn.push(Math.abs(token.value).toString());
      } else if (token.type === TokenType.PRIMITIVE_PRONUMERAL) {
        if (DEBUG_VIEW && group.type === TokenType.GROUP_MUL && i > 0 && group.tokens[i - 1].type != TokenType.PRIMITIVE_NUMBER) {
          toReturn.push('\\cdot');
        }
        if (group.type === TokenType.GROUP_ADD && i > 0) toReturn.push("+");
        if (note && note.noteStart === i) {
          toReturn.push("\\overbrace{");
        }
        toReturn.push(token.numeral);
      } else {
        const sign = getSignOfTokenGroup(token);
        if (DEBUG_VIEW && group.type === TokenType.GROUP_MUL && i > 0) {
          toReturn.push('\\cdot');
        }
        if ((i > 0 && group.type === TokenType.GROUP_ADD) || sign === '-') {
          toReturn.push(sign)
        }
        if (note && note.noteStart === i) {
          toReturn.push("\\overbrace{");
        }
        toReturn = toReturn.concat(TokenGroupComponent({ group: token, algorithmStep }));
      }
      if (note && (note.noteEnd === i || (note.noteEnd >= group.tokens.length && i === group.tokens.length - 1))) {
        toReturn.push("}^{");
        if (note.noteContentsToken) {
          const noteContents = TokenGroupComponent({ group: note.noteContentsToken, algorithmStep });
          if (noteContents.length === 0) {
            console.error('renders empty:', note.noteContentsToken)
          }
          toReturn = toReturn.concat(noteContents.length === 0 ? '0' : noteContents);
        } else if (note.noteContentsText) {
          toReturn.push(`\\text{${note.noteContentsText}}`)
        }
        toReturn.push("}");
      }
    }
    if (parens) toReturn.push(')')
  } else if (group.type === TokenType.GROUP_DIV) {
    toReturn = toReturn.concat('{', TokenGroupComponent({ group: group.numerator, noParens: true, algorithmStep }), '\\over', TokenGroupComponent({ group: group.denominator, noParens: true, algorithmStep }), '}')
  } else if (group.type === TokenType.GROUP_POW) {
    let base = TokenGroupComponent({ group: group.base, algorithmStep });
    // When an exponent has anything other than a primitive base needs to be wrapped in parens to make it clear
    if (group.base.tokens.length > 1 || isGroupToken(group.base.tokens[0])) {
      base = ['(', ...base, ')'];
    }
    toReturn = toReturn.concat(base, '^', '{', TokenGroupComponent({ group: group.exponent, noParens: true, algorithmStep }), '}')
  }
  return toReturn;
}

function findLikeTermsInToken(token: Token, primitiveNumberIsSignificant: boolean = false) {
  let terms: string[] = []
  switch (token.type) {
    case TokenType.PRIMITIVE_NUMBER: {
      if (primitiveNumberIsSignificant) {
        terms.push(token.value.toString());
      }
      break;
    }
    case TokenType.PRIMITIVE_PRONUMERAL: {
      terms.push(token.numeral);
      break;
    }
    case TokenType.GROUP_MUL: {
      for (const subToken of token.tokens) {
        terms = terms.concat(findLikeTermsInToken(subToken));
      }
      break;
    }
    case TokenType.GROUP_POW: {
      terms = terms.concat("(");
      for (const subToken of token.base.tokens) {
        terms = terms.concat(findLikeTermsInToken(subToken));
      }
      terms = terms.concat("^");
      for (const subToken of token.exponent.tokens) {
        terms = terms.concat(findLikeTermsInToken(subToken, true));
      }
      terms = terms.concat(")");
      break;
    }
    case TokenType.GROUP_ADD: {
      terms.push("(");
      terms = terms.concat(findLikeTermsInToken(token.tokens[0]));
      for (let i = 1; i < token.tokens.length; i++) {
        terms = terms.concat(findLikeTermsInToken(token.tokens[i]));
      }
      terms.push(")");
      break;
    }
    case TokenType.GROUP_DIV: {
      terms.push('undefined');
    }
  }
  return terms;
}

function findCommonFactorsInAddGroup(group: TokenGroupAdd): { number: number, numerals: string[] } {
  const rawValues: number[] = [];
  const rawPronumerals: { [key: string]: number } = {};
  function getCommonFactorOfToken(token: Token) {
    switch (token.type) {
      case TokenType.GROUP_MUL: {
        for (let i = 0; i < token.tokens.length; i++) {
          const mulToken = token.tokens[i];
          getCommonFactorOfToken(mulToken);
        }
        break;
      }
      case TokenType.PRIMITIVE_NUMBER: {
        rawValues.push(Math.abs(token.value));
        break;
      }
      case TokenType.PRIMITIVE_PRONUMERAL: {
        if (!rawPronumerals[token.numeral]) {
          rawPronumerals[token.numeral] = 0;
        }
        rawPronumerals[token.numeral]++;
        break;
      }
      case TokenType.GROUP_POW: {
        if (token.base.tokens.length === 1 && token.base.tokens[0].type === TokenType.PRIMITIVE_PRONUMERAL) {
          if (!rawPronumerals[token.base.tokens[0].numeral]) {
            rawPronumerals[token.base.tokens[0].numeral] = 0;
          }
          rawPronumerals[token.base.tokens[0].numeral]++;
        }
        break;
      }
    }
  }

  for (const token of group.tokens) {
    getCommonFactorOfToken(token);
  };
  const toReturn: { number: number, numerals: string[] } = {
    number: 1,
    numerals: []
  }
  if (rawValues.length === group.tokens.length) {
    let gcd = rawValues[0];
    if (gcd > 1) {
      toReturn.number = gcd
    }
  }
  for (const numeral of Object.keys(rawPronumerals)) {
    if (rawPronumerals[numeral] === group.tokens.length) {
      toReturn.numerals.push(numeral)
    }
  }
  return toReturn;
}

function extractCommonFactorsInAddGroup(group: TokenGroupAdd, factors: { number: number, numerals: string[] }) {
  for (let i = 0; i < group.tokens.length; i++) {
    const token = group.tokens[i];
    switch (token.type) {
      case TokenType.GROUP_MUL: {
        for (let j = 0; j < token.tokens.length; j++) {
          const mulToken = token.tokens[j];
          switch (mulToken.type) {
            case TokenType.PRIMITIVE_NUMBER: {
              mulToken.value /= factors.number;
              break;
            }
            case TokenType.PRIMITIVE_PRONUMERAL: {
              if (factors.numerals.includes(mulToken.numeral)) {
                token.tokens.splice(j, 1, { type: TokenType.PRIMITIVE_NUMBER, id: nextTokenId++, value: 1 });
                j--;
              }
              break;
            }
            case TokenType.GROUP_POW: {
              if (mulToken.base.tokens.length === 1 && mulToken.base.tokens[0].type === TokenType.PRIMITIVE_PRONUMERAL && factors.numerals.includes(mulToken.base.tokens[0].numeral)) {
                mulToken.exponent.tokens.push({ type: TokenType.PRIMITIVE_NUMBER, id: nextTokenId++, value: -1 });
              }
              break;
            }
          }
        }
        break;
      }
      case TokenType.PRIMITIVE_NUMBER: {
        token.value /= factors.number;
        break;
      }
      case TokenType.PRIMITIVE_PRONUMERAL: {
        if (factors.numerals.includes(token.numeral)) {
          group.tokens.splice(i, 1, { type: TokenType.PRIMITIVE_NUMBER, id: nextTokenId++, value: 1 });
          i--;
        }
        break;
      }
      case TokenType.GROUP_POW: {
        if (token.base.tokens.length === 1 && token.base.tokens[0].type === TokenType.PRIMITIVE_PRONUMERAL && factors.numerals.includes(token.base.tokens[0].numeral)) {
          token.exponent.tokens.push({ type: TokenType.PRIMITIVE_NUMBER, id: nextTokenId++, value: -1 });
        }
        break;
      }
    }
  }
}

function regenerateAllIdsInTree(token: Token) {
  switch (token.type) {
    case TokenType.GROUP_ADD:
    case TokenType.GROUP_MUL: {
      token.id = nextTokenId++;
      for (const subToken of token.tokens) {
        regenerateAllIdsInTree(subToken);
      }
      break;
    }
    case TokenType.GROUP_DIV: {
      regenerateAllIdsInTree(token.numerator);
      regenerateAllIdsInTree(token.denominator);
      break;
    }
    case TokenType.GROUP_POW: {
      regenerateAllIdsInTree(token.base);
      regenerateAllIdsInTree(token.exponent);
      break;
    }
  }
}

function multiplyPrimitivePrimitive(token1: TokenPrimitive, token2: TokenPrimitive): TokenPrimitive | TokenGroupPow {
  if (token1.type === TokenType.PRIMITIVE_NUMBER && token2.type === TokenType.PRIMITIVE_NUMBER) {
    token1.value *= token2.value;
    return token1;
  } else if (token1.type === TokenType.PRIMITIVE_PRONUMERAL && token2.type === TokenType.PRIMITIVE_PRONUMERAL && token1.numeral === token2.numeral) {
    return {
      type: TokenType.GROUP_POW,
      base: { type: TokenType.GROUP_ADD, id: nextTokenId++, tokens: [token1] },
      exponent: { type: TokenType.GROUP_ADD, id: nextTokenId++, tokens: [{ type: TokenType.PRIMITIVE_NUMBER, id: nextTokenId++, value: 2 }] }
    }
  } else {
    const number = (token1.type === TokenType.PRIMITIVE_NUMBER ? token1 : token2) as TokenPrimitiveNumber;
    const numeral = (token1.type === TokenType.PRIMITIVE_PRONUMERAL ? token1 : token2) as TokenPrimitivePronumeral;
    if (number.value === 1) {
      return numeral;
    }
  }
}

function multiplyMulPrimitive(mulGroup: TokenGroupMul, primitive: TokenPrimitive) {
  if (primitive.type === TokenType.PRIMITIVE_NUMBER && primitive.value === 1) {
    return mulGroup;
  }
  mulGroup.tokens.push(primitive);
  return mulGroup;
}

function multiplyAddPrimitive(addGroup: TokenGroupAdd, primitive: TokenPrimitive) {
  if (primitive.type === TokenType.PRIMITIVE_NUMBER && primitive.value === 1) {
    return addGroup;
  }
  const toReturn: TokenGroupAdd = { type: TokenType.GROUP_ADD, id: nextTokenId++, tokens: [] }
  for (var i = 0; i < addGroup.tokens.length; i++) {
    const rightSide = JSON.parse(JSON.stringify(addGroup.tokens[i]));
    regenerateAllIdsInTree(rightSide);
    toReturn.tokens[i] = {
      type: TokenType.GROUP_MUL,
      id: nextTokenId++,
      tokens: [
        primitive,
        rightSide
      ]
    }
  }
  return toReturn;
}

function multiplyAddMul(addGroup: TokenGroupAdd, mulGroup: TokenGroupMul) {
  const toReturn: TokenGroupAdd = { type: TokenType.GROUP_ADD, id: nextTokenId++, tokens: [] }
  for (var i = 0; i < addGroup.tokens.length; i++) {
    toReturn.tokens[i] = {
      type: TokenType.GROUP_MUL,
      id: nextTokenId++,
      tokens: [
        ...mulGroup.tokens,
        addGroup.tokens[i]
      ]
    }
  }
  return toReturn;
}

function multiplyAddAdd(groupOne: TokenGroupAdd, groupTwo: TokenGroupAdd) {
  const toReturn: TokenGroupAdd = { type: TokenType.GROUP_ADD, id: nextTokenId++, tokens: [] }
  for (var i = 0; i < groupOne.tokens.length; i++) {
    for (var j = 0; j < groupTwo.tokens.length; j++) {
      const rightSide = JSON.parse(JSON.stringify(groupTwo.tokens[j]));
      regenerateAllIdsInTree(rightSide);
      toReturn.tokens[(i * groupTwo.tokens.length) + j] = {
        type: TokenType.GROUP_MUL,
        id: nextTokenId++,
        tokens: [
          JSON.parse(JSON.stringify(groupOne.tokens[i])),
          rightSide
        ]
      }
    }
  }
  return toReturn
}

function multiplyMulDiv(mulGroup: TokenGroupMul, divGroup: TokenGroupDiv) {
  divGroup.numerator = multiply(divGroup.numerator, mulGroup) as TokenGroupAdd;
  return divGroup;
}

function multiplyDivDiv(groupOne: TokenGroupDiv, groupTwo: TokenGroupDiv) {
  groupOne.numerator = multiply(groupOne.numerator, groupTwo.numerator) as TokenGroupAdd;
  groupOne.denominator = multiply(groupOne.denominator, groupTwo.denominator) as TokenGroupAdd;
  return groupOne;
}

function multiplyDivPrimitive(divGroup: TokenGroupDiv, primitive: TokenPrimitive) {
  if (primitive.type === TokenType.PRIMITIVE_NUMBER && primitive.value === 1) {
    return divGroup;
  }
  divGroup.numerator = multiply(divGroup.numerator, primitive) as TokenGroupAdd;
  return divGroup;
}

function multiplyPowPrimitive(powGroup: TokenGroupPow, primitive: TokenPrimitive) {
  if (primitive.type === TokenType.PRIMITIVE_NUMBER) {
    return primitive.value === 1 ? powGroup : undefined;
  } else if (powGroup.base.tokens.length === 1 && powGroup.base.tokens[0].type === TokenType.PRIMITIVE_PRONUMERAL && powGroup.base.tokens[0].numeral === primitive.numeral) {
    powGroup.exponent.tokens.push({ type: TokenType.PRIMITIVE_NUMBER, id: nextTokenId++, value: 1 })
    return powGroup;
  }
}

function multiplyPowAdd(powGroup: TokenGroupPow, addGroup: TokenGroupAdd) {
  const toReturn: TokenGroupAdd = { type: TokenType.GROUP_ADD, id: nextTokenId++, tokens: [] }
  for (var i = 0; i < addGroup.tokens.length; i++) {
    toReturn.tokens[i] = {
      type: TokenType.GROUP_MUL,
      id: nextTokenId++,
      tokens: [
        powGroup,
        addGroup.tokens[i]
      ]
    }
  }
  return toReturn;
}

function multiplyPowDiv(powGroup: TokenGroupPow, divGroup: TokenGroupDiv) {
  divGroup.numerator = multiply(powGroup, divGroup.numerator) as TokenGroupAdd;
  return divGroup;
}

function multiplyPowPow(group1: TokenGroupPow, group2: TokenGroupPow): TokenGroupPow | undefined {
  if (canAddTerms(group1.base, group2.base)) {
    group1.exponent.tokens.push(group2.exponent);
    return group1;
  } else if (canAddTerms(group1.exponent, group2.exponent)) {
    group1.base = {
      type: TokenType.GROUP_ADD,
      id: nextTokenId++,
      tokens: [{
        type: TokenType.GROUP_MUL,
        id: nextTokenId++,
        tokens: [
          group1.base,
          group2.base
        ]
      }]
    }
    return group1;
  }
  return undefined;
}

// TODO implement mul for exponents
function multiply(token1: Token, token2: Token): Token | undefined {
  process.env.NODE_ENV === 'development' && console.log('multiply: ', JSON.parse(JSON.stringify(token1)), JSON.parse(JSON.stringify(token2)));
  token1 = JSON.parse(JSON.stringify(token1));
  token2 = JSON.parse(JSON.stringify(token2));
  switch (token1.type) {
    case TokenType.GROUP_ADD: {
      switch (token2.type) {
        case TokenType.GROUP_ADD: { // ADD * ADD ------------------
          return multiplyAddAdd(token1, token2);
        }
        case TokenType.GROUP_MUL: { // ADD * MUL ------------------
          return multiplyAddMul(token1, token2);
        }
        case TokenType.GROUP_POW: { // POW * ADD ------------------
          return multiplyPowAdd(token2, token1);
        }
        case TokenType.PRIMITIVE_PRONUMERAL:
        case TokenType.PRIMITIVE_NUMBER: { // ADD * PRIMITIVE -----
          return multiplyAddPrimitive(token1, token2);
        }
      }
      break;
    }
    case TokenType.GROUP_MUL: {
      switch (token2.type) {
        case TokenType.GROUP_ADD: { // MUL * ADD ------------------
          return multiplyAddMul(token2, token1);
        }
        case TokenType.GROUP_DIV: { // MUL * DIV ------------------
          return multiplyMulDiv(token1, token2);
        }
        case TokenType.PRIMITIVE_PRONUMERAL:
        case TokenType.PRIMITIVE_NUMBER: { // MUL * PRIMITIVE -----
          return multiplyMulPrimitive(token1, token2);
        }
      }
      break;
    }
    case TokenType.GROUP_DIV: {
      switch (token2.type) {
        case TokenType.GROUP_MUL: { // DIV * MUL ------------------
          return multiplyMulDiv(token2, token1);
        }
        case TokenType.GROUP_DIV: { // DIV * DIV ------------------
          return multiplyDivDiv(token1, token2);
        }
        case TokenType.GROUP_POW: { // POW * DIV ------------------
          return multiplyPowDiv(token2, token1);
        }
        case TokenType.PRIMITIVE_PRONUMERAL:
        case TokenType.PRIMITIVE_NUMBER: { // DIV * PRIMITIVE -
          return multiplyDivPrimitive(token1, token2);
        }
      }
      break;
    }
    case TokenType.GROUP_POW: {
      switch (token2.type) {
        case TokenType.GROUP_ADD: { // POW * ADD ------------------
          return multiplyPowAdd(token1, token2);
        }
        case TokenType.GROUP_DIV: { // POW * DIV ------------------
          return multiplyPowDiv(token1, token2);
        }
        case TokenType.GROUP_POW: { // POW * DIV ------------------
          return multiplyPowPow(token1, token2);
        }
        case TokenType.PRIMITIVE_PRONUMERAL:
        case TokenType.PRIMITIVE_NUMBER: { // POW * PRIMITIVE -
          return multiplyPowPrimitive(token1, token2);
        }
      }
      break;
    }
    case TokenType.PRIMITIVE_NUMBER: {
      switch (token2.type) {
        case TokenType.GROUP_ADD: { // ADD * PRIMITIVE ------------
          return multiplyAddPrimitive(token2, token1);
        }
        case TokenType.GROUP_MUL: { // PRIMITIVE * MUL ------------
          return multiplyMulPrimitive(token2, token1);
        }
        case TokenType.GROUP_DIV: { // DIV * PRIMITIVE ------------
          return multiplyDivPrimitive(token2, token1);
        }
        case TokenType.GROUP_POW: { // POW * PRIMITIVE ------------
          return multiplyPowPrimitive(token2, token1)
        }
        case TokenType.PRIMITIVE_PRONUMERAL:
        case TokenType.PRIMITIVE_NUMBER: { // PRIMITIVE * PRIMITIVE -
          return multiplyPrimitivePrimitive(token1, token2);
        }
      }
      break;
    }
    case TokenType.PRIMITIVE_PRONUMERAL: {
      switch (token2.type) {
        case TokenType.GROUP_MUL: {
          return multiplyMulPrimitive(token2, token1);
        }
        case TokenType.GROUP_DIV: { // DIV * DIV ------------------
          return multiplyDivPrimitive(token2, token1);
        }
        case TokenType.GROUP_POW: {        // POW * PRIMITIVE -
          return multiplyPowPrimitive(token2, token1)
        }
        case TokenType.PRIMITIVE_PRONUMERAL:
        case TokenType.PRIMITIVE_NUMBER: { // PRIMITIVE * PRIMITIVE -
          return multiplyPrimitivePrimitive(token1, token2);
        }
      }
    }
  }
  process.env.NODE_ENV === 'development' && console.log(`WARNING: Unimplemented multiply case fell through: `, JSON.parse(JSON.stringify(token1)), JSON.parse(JSON.stringify(token2)));
}

function addPrimitivePrimitive(token1: TokenPrimitive, token2: TokenPrimitive) {
  const canAdd = canAddTerms(token1, token2);
  process.env.NODE_ENV === 'development' && console.log("Can add:", canAdd);
  if (!canAdd) {
    return undefined;
  }
  if (token1.type !== token2.type) {
    return undefined;
  }
  if (token1.type === TokenType.PRIMITIVE_NUMBER) {
    token1.value += (token2 as TokenPrimitiveNumber).value;
    console.log('new value', token1.value);
    return token1;
  }
  if (token1.type === TokenType.PRIMITIVE_PRONUMERAL) {
    const newToken: TokenGroupMul = {
      type: TokenType.GROUP_MUL,
      id: nextTokenId++,
      tokens: [
        { type: TokenType.PRIMITIVE_NUMBER, id: nextTokenId++, value: 2 },
        token1
      ]
    };
    return newToken;
  }
}

function addMulPrimitive(mulGroup: TokenGroupMul, token2: TokenPrimitive) {
  const canAdd = canAddTerms(mulGroup, token2);
  process.env.NODE_ENV === 'development' && console.log("Can add:", canAdd);
  if (!canAdd) {
    return undefined;
  }
  const tokenIndex = mulGroup.tokens.findIndex((t): t is TokenPrimitiveNumber => t.type === TokenType.PRIMITIVE_NUMBER);
  if (tokenIndex > -1) {
    (mulGroup.tokens[tokenIndex] as TokenPrimitiveNumber).value++;
    return mulGroup;
  } else {
    mulGroup.tokens.splice(0, 0, {
      type: TokenType.PRIMITIVE_NUMBER,
      id: nextTokenId++,
      value: 2,
    })
    return mulGroup;
  }
}

function addMulMul(group1: TokenGroupMul, group2: TokenGroupMul): TokenGroupMul {
  const canAdd = canAddTerms(group1, group2);
  process.env.NODE_ENV === 'development' && console.log("Can add:", canAdd);
  if (!canAdd) {
    return undefined;
  }
  const primitive1 = group1.tokens.find((t): t is TokenPrimitiveNumber => t.type === TokenType.PRIMITIVE_NUMBER) as TokenPrimitiveNumber;
  const primitive2 = group2.tokens.find((t): t is TokenPrimitiveNumber => t.type === TokenType.PRIMITIVE_NUMBER) as TokenPrimitiveNumber;
  if (primitive1 && primitive2) {
    primitive1.value += primitive2.value;
    return group1;
  } else if (primitive1 && !primitive2) {
    primitive1.value++;
    return group1;
  } else if (!primitive1 && primitive2) {
    primitive2.value++;
    return group2;
  } else {
    return {
      type: TokenType.GROUP_MUL,
      id: nextTokenId++,
      tokens: [
        { type: TokenType.PRIMITIVE_NUMBER, id: nextTokenId++, value: 2 },
        ...group1.tokens
      ]
    }
  }
}

function addDivDiv(group1: TokenGroupDiv, group2: TokenGroupDiv) {
  if (canAddTerms(group1.denominator, group2.denominator)) {
    group1.numerator = {
      type: TokenType.GROUP_ADD,
      id: nextTokenId++,
      tokens: [
        group1.numerator,
        group2.numerator
      ]
    }
    return group1;
  }
}

function addPowPrimitive(_: TokenGroupPow, __: TokenPrimitive) {
  return undefined;
}

function addPowMul(powGroup: TokenGroupPow, mulGroup: TokenGroupMul) {
  const canAdd = canAddTerms(powGroup, mulGroup);
  if (!canAdd) {
    return undefined;
  }
  const tokenIndex = mulGroup.tokens.findIndex((t): t is TokenPrimitiveNumber => t.type === TokenType.PRIMITIVE_NUMBER);
  if (tokenIndex > -1) {
    (mulGroup.tokens[tokenIndex] as TokenPrimitiveNumber).value++;
  } else {
    mulGroup.tokens.splice(0, 0, {
      type: TokenType.PRIMITIVE_NUMBER,
      id: nextTokenId++,
      value: 2,
    })
  }
  return mulGroup;
}


function canAddTerms(token1: Token, token2: Token) {
  const likeTerms1 = findLikeTermsInToken(token1);
  const likeTerms2 = findLikeTermsInToken(token2);
  process.env.NODE_ENV === 'development' && console.log("Like terms:", likeTerms1, likeTerms2);
  if (likeTerms1.length !== likeTerms2.length) {
    return false;
  }
  for (let i = 0; i < likeTerms1.length; i++) {
    if (likeTerms1[i] !== likeTerms2[i] || likeTerms1[i] === 'undefined' || likeTerms2[i] === 'undefined') {
      return false;
    }
  }
  return true;
}

function add(token1: Token, token2: Token): Token | undefined {
  process.env.NODE_ENV === 'development' && console.log('add: ', JSON.parse(JSON.stringify(token1)), JSON.parse(JSON.stringify(token2)));
  token1 = JSON.parse(JSON.stringify(token1));
  token2 = JSON.parse(JSON.stringify(token2));
  switch (token1.type) {
    case TokenType.PRIMITIVE_NUMBER: {
      switch (token2.type) {
        case TokenType.GROUP_MUL: {
          return addMulPrimitive(token2, token1);
        }
        case TokenType.GROUP_POW: { // POW * PRIMITIVE ------------
          return addPowPrimitive(token2, token1)
        }
        case TokenType.PRIMITIVE_PRONUMERAL:
        case TokenType.PRIMITIVE_NUMBER: { // PRIMITIVE + PRIMITIVE -
          return addPrimitivePrimitive(token1, token2);
        }
      }
      break;
    }
    case TokenType.PRIMITIVE_PRONUMERAL: {
      switch (token2.type) {
        case TokenType.GROUP_MUL: {
          return addMulPrimitive(token2, token1);
        }
        case TokenType.GROUP_POW: { // POW * PRIMITIVE ------------
          return addPowPrimitive(token2, token1)
        }
        case TokenType.PRIMITIVE_PRONUMERAL:
        case TokenType.PRIMITIVE_NUMBER: { // PRIMITIVE + PRIMITIVE -
          return addPrimitivePrimitive(token1, token2);
        }
      }
      break;
    }
    case TokenType.GROUP_MUL: {
      switch (token2.type) {
        case TokenType.GROUP_MUL: {
          return addMulMul(token1, token2);
        }
        case TokenType.GROUP_POW: { // POW * PRIMITIVE ------------
          return addPowMul(token2, token1)
        }
        case TokenType.PRIMITIVE_PRONUMERAL:
        case TokenType.PRIMITIVE_NUMBER: { // PRIMITIVE + PRIMITIVE -
          return addMulPrimitive(token1, token2);
        }
      }
      break;
    }
    case TokenType.GROUP_POW: {
      switch (token2.type) {
        case TokenType.GROUP_MUL: {
          return addPowMul(token1, token2);
        }
        case TokenType.PRIMITIVE_PRONUMERAL:
        case TokenType.PRIMITIVE_NUMBER: { // PRIMITIVE + PRIMITIVE -
          return addPowPrimitive(token1, token2);
        }
      }
      break;
    }
    case TokenType.GROUP_DIV: {
      switch (token2.type) {
        case TokenType.GROUP_DIV: {
          return addDivDiv(token1, token2);
        }
      }
    }
  }
  process.env.NODE_ENV === 'development' && console.log(`WARNING: Unimplemented add case fell through: `, JSON.parse(JSON.stringify(token1)), JSON.parse(JSON.stringify(token2)));
}

function mergeRedundantTokensUpwardsIntoParent(group: TokenGroup, token: Token) {
  process.env.NODE_ENV === 'development' && console.log('checking merge', token)
  switch (group.type) {
    case TokenType.GROUP_MUL:
    case TokenType.GROUP_ADD: {
      const index = group.tokens.findIndex(t => t === token);
      switch (token.type) {
        case TokenType.GROUP_MUL:
        case TokenType.GROUP_ADD: {
          if (token.tokens.length === 0) {
            process.env.NODE_ENV === 'development' && console.log("remove length 0");
            group.tokens.splice(index, 1);
            return true;
          }
          if (token.tokens.length === 1) {
            process.env.NODE_ENV === 'development' && console.log("merge length 1");
            group.tokens.splice(index, 1, token.tokens[0]);
            return true;
          }
          if (group.type === token.type) {
            process.env.NODE_ENV === 'development' && console.log("merge same type");
            group.tokens = [...group.tokens.slice(0, index), ...token.tokens, ...group.tokens.slice(index + 1)];
            return true;
          }
          if (token.type === TokenType.GROUP_MUL && token.tokens.find(t => t.type === TokenType.PRIMITIVE_NUMBER && t.value === 0)) {
            process.env.NODE_ENV === 'development' && console.log("remove multiply by zero");
            group.tokens.splice(index, 1);
            return true;
          }
          break;
        }
        case TokenType.GROUP_DIV: {
          if (token.numerator.tokens[0].type === TokenType.PRIMITIVE_NUMBER && token.numerator.tokens[0].value === 0) { // Numerator is 0
            process.env.NODE_ENV === 'development' && console.log("removing NUMERATOR 0")
            group.tokens.splice(index, 1);
            return true;
          } else if (token.denominator.tokens.length === 0 || (token.denominator.tokens.length === 1 && token.denominator.tokens[0].type === TokenType.PRIMITIVE_NUMBER && token.denominator.tokens[0].value === 1)) {
            process.env.NODE_ENV === 'development' && console.log('removing DENOM 1')
            group.tokens.splice(index, 1, token.numerator);
            return true;
          }
          break;
        }
        case TokenType.GROUP_POW: {
          if (token.exponent.tokens.length === 1 && token.exponent.tokens[0].type === TokenType.PRIMITIVE_NUMBER && token.exponent.tokens[0].value === 1) {
            process.env.NODE_ENV === 'development' && console.log('removing POW 1')
            group.tokens.splice(index, 1, token.base);
            return true;
          }
          break;
        }
        case TokenType.PRIMITIVE_NUMBER: {
          if (group.type === TokenType.GROUP_ADD && token.value === 0) {
            group.tokens.splice(index, 1);
            console.log('remove zero in add');
            return true;
          }
          break;
        }
      }
    }
  }
  return false;
}

// Returns true if the group should be merged upwards
function mergeTokensInGroup(group: TokenGroup) {
  switch (group.type) {
    case TokenType.GROUP_MUL: {
      for (const token of group.tokens) {
        isGroupToken(token) && mergeTokensInGroup(token);
        mergeRedundantTokensUpwardsIntoParent(group, token);
      }
      console.log("mul length", group.tokens.length, JSON.parse(JSON.stringify(group)));
      for (let i = 0; i < group.tokens.length; i++) {
        console.log('i loop', i);
        for (let j = i + 1; j < group.tokens.length; j++) {
          console.log('j loop', i, j);
          const result = multiply(group.tokens[i], group.tokens[j]);
          const previous = JSON.parse(JSON.stringify(equations));
          if (result) {
            const distribute = group.tokens[i].type === TokenType.GROUP_ADD || group.tokens[j].type === TokenType.GROUP_ADD
            DEBUG_VIEW && previousSteps[previousSteps.length - 1].subSteps.push({
              operator: { operator: InputOperator.MULTIPLY }, state: previous, note:
              {
                groupId: group.id, noteStart: i, noteEnd: Math.min(j, group.tokens.length - 1),
                noteContentsToken: distribute ? undefined : { type: TokenType.GROUP_ADD, id: -1, tokens: [JSON.parse(JSON.stringify(result))] },
                noteContentsText: distribute ? 'distribute' : undefined
              }
            });
            process.env.NODE_ENV === 'development' && console.log('multiply result:', JSON.parse(JSON.stringify(result)))
            group.tokens.splice(j, 1);
            group.tokens.splice(i, 1, result);
            isGroupToken(result) && mergeTokensInGroup(result);
            mergeRedundantTokensUpwardsIntoParent(group, group.tokens[i]);
            i = -1;
            console.log('breaking');
            break;
          } else {
            process.env.NODE_ENV === 'development' && console.log('multiply had no effect');
          }
        }
      }
      // Sort tokens by number first then alphabetical
      process.env.NODE_ENV === 'development' && console.log('sort');
      group.tokens.sort((a, b) => {
        if (a.type === TokenType.PRIMITIVE_NUMBER) {
          return -1;
        } else if (a.type === TokenType.PRIMITIVE_PRONUMERAL) {
          if (b.type === TokenType.PRIMITIVE_PRONUMERAL) {
            return a.numeral > b.numeral ? 1 : -1;
          } else if (b.type === TokenType.PRIMITIVE_NUMBER) {
            return 1;
          }
        } else if (b.type === TokenType.PRIMITIVE_PRONUMERAL) {
          return -1;
        }
        return 1;
      });
      break;
    }
    case TokenType.GROUP_DIV: {
      mergeTokensInGroup(group.numerator);
      mergeTokensInGroup(group.denominator);
      const numeratorFactors = findCommonFactorsInAddGroup(group.numerator);
      const denominatorFactors = findCommonFactorsInAddGroup(group.denominator);
      const gcd = getGCD(numeratorFactors.number, denominatorFactors.number)
      const pronumeralCrossover = numeratorFactors.numerals.filter(n => denominatorFactors.numerals.includes(n));
      if (gcd > 1 || pronumeralCrossover.length > 0) {
        DEBUG_VIEW && previousSteps[previousSteps.length - 1].subSteps.push({ operator: { operator: InputOperator.DIVIDE }, state: JSON.parse(JSON.stringify(equations)) });
        process.env.NODE_ENV === 'development' && console.log('extracting common factors', { number: gcd, numerals: pronumeralCrossover });
        extractCommonFactorsInAddGroup(group.numerator, { number: gcd, numerals: pronumeralCrossover });
        extractCommonFactorsInAddGroup(group.denominator, { number: gcd, numerals: pronumeralCrossover });
      }
      process.env.NODE_ENV === 'development' && console.log("NUMERATOR---")
      mergeTokensInGroup(group.numerator);
      process.env.NODE_ENV === 'development' && console.log("DENOMINATOR---")
      mergeTokensInGroup(group.denominator);
      break;
    }
    case TokenType.GROUP_ADD: {
      for (const token of group.tokens) {
        isGroupToken(token) && mergeTokensInGroup(token);
        mergeRedundantTokensUpwardsIntoParent(group, token);
      }
      for (let i = 0; i < group.tokens.length - 1; i++) {
        for (let j = i + 1; j < group.tokens.length; j++) {
          process.env.NODE_ENV === 'development' && console.log("add", group.tokens[i], group.tokens[j]);
          const previous = JSON.parse(JSON.stringify(equations));
          const result = add(group.tokens[i], group.tokens[j]);
          if (result) {
            DEBUG_VIEW && previousSteps[previousSteps.length - 1].subSteps.push({
              operator: { operator: InputOperator.ADD }, state: previous, note:
              {
                groupId: group.id, noteStart: i, noteEnd: Math.min(j, group.tokens.length - 1),
                noteContentsToken: { type: TokenType.GROUP_ADD, id: -1, tokens: [JSON.parse(JSON.stringify(result))] }
              }
            });
            process.env.NODE_ENV === 'development' && console.log("add result", JSON.parse(JSON.stringify(result)))
            group.tokens.splice(j, 1);
            group.tokens.splice(i, 1, result);
            i = -1;
            break;
          } else {
            process.env.NODE_ENV === 'development' && console.log("add had no effect")
          }
        }
      }
      for (const token of group.tokens) {
        isGroupToken(token) && mergeTokensInGroup(token);
        mergeRedundantTokensUpwardsIntoParent(group, token);
      }
      break;
    }
    case TokenType.GROUP_POW: {
      mergeTokensInGroup(group.base);
      mergeTokensInGroup(group.exponent);
      break;
    }
  }
}

function applyOperator(operator: InputOperatorObject) {
  process.env.NODE_ENV === 'development' && console.log('-------------------------------------------------------------------------')
  previousSteps.push({ operator, state: JSON.parse(JSON.stringify(equations)), subSteps: [] });
  const stepOperator = { operator: operator.operator, value: undefined };
  for (let equationIndex = 0; equationIndex < equations.length; equationIndex++) {
    const equation = equations[equationIndex];
    switch (operator.operator) {
      case InputOperator.ADD:
      case InputOperator.SUBTRACT: {
        const numberGroup: TokenPrimitiveNumber = { type: TokenType.PRIMITIVE_NUMBER, id: nextTokenId++, value: operator.value! };
        const pronumeralGroup: TokenPrimitivePronumeral = { type: TokenType.PRIMITIVE_PRONUMERAL, id: nextTokenId++, numeral: operator.numeral! };
        const mulGroup = operator.value !== 1 ? { type: TokenType.GROUP_MUL, id: nextTokenId++, tokens: [numberGroup, pronumeralGroup] } as TokenGroupMul : pronumeralGroup;
        equation.tokens.push(!operator.numeral ? numberGroup : mulGroup);
        previousSteps[previousSteps.length - 1].subSteps.push({ operator: stepOperator, state: JSON.parse(JSON.stringify(equations)) });
        mergeTokensInGroup(equation);
        break;
      }
      case InputOperator.MULTIPLY: {
        const pronumeralGroup = !operator.numeral ? { type: TokenType.PRIMITIVE_NUMBER, value: operator.value } as TokenPrimitiveNumber : { type: TokenType.PRIMITIVE_PRONUMERAL, numeral: operator.numeral } as TokenPrimitivePronumeral;
        equations[equationIndex] = {
          type: TokenType.GROUP_ADD,
          id: nextTokenId++,
          tokens: [
            {
              type: TokenType.GROUP_MUL,
              id: nextTokenId++,
              tokens: [
                pronumeralGroup,
                equations[equationIndex]
              ]
            }
          ]
        }
        previousSteps[previousSteps.length - 1].subSteps.push({ operator, state: JSON.parse(JSON.stringify(equations)) });
        mergeTokensInGroup(equations[equationIndex]);
        break;
      }
      case InputOperator.DIVIDE: {
        for (let i = 0; i < equation.tokens.length; i++) {
          const pronumeralGroup = !operator.numeral ? { type: TokenType.PRIMITIVE_NUMBER, value: operator.value } as TokenPrimitiveNumber : { type: TokenType.PRIMITIVE_PRONUMERAL, numeral: operator.numeral } as TokenPrimitivePronumeral;
          const token = equation.tokens[i];
          // DIV is just a multiply by reciprocal
          const newGroup: TokenGroupMul = {
            type: TokenType.GROUP_MUL,
            id: nextTokenId++,
            tokens: [
              token,
              {
                type: TokenType.GROUP_DIV,
                numerator: {
                  type: TokenType.GROUP_ADD,
                  id: nextTokenId++,
                  tokens: [{ type: TokenType.PRIMITIVE_NUMBER, id: nextTokenId++, value: 1 }]
                },
                denominator: {
                  type: TokenType.GROUP_ADD,
                  id: nextTokenId++,
                  tokens: [pronumeralGroup]
                },
              }
            ]
          }
          equation.tokens.splice(i, 1, newGroup);
        }
        previousSteps[previousSteps.length - 1].subSteps.push({ operator: stepOperator, state: JSON.parse(JSON.stringify(equations)) });
        for (const token of equation.tokens) {
          mergeTokensInGroup(token as TokenGroupMul);
        }
        break;
      }
      case InputOperator.EXPONENT: {
        const originalEquation = JSON.parse(JSON.stringify(equations[equationIndex]));
        for (let i = 0; i < operator.value - 1; i++) {
          if (i > 0) {
            const previousEquations = JSON.parse(JSON.stringify(equations));
            DEBUG_VIEW && previousSteps[previousSteps.length - 1].subSteps.push({ operator, state: previousEquations });
          }
          const newGroup = {
            type: TokenType.GROUP_MUL,
            id: nextTokenId++,
            tokens: [
              JSON.parse(JSON.stringify(originalEquation)),
              JSON.parse(JSON.stringify(equations[equationIndex])),
            ]
          } as TokenGroupMul
          equations[equationIndex] = {
            type: TokenType.GROUP_ADD,
            id: nextTokenId++,
            tokens: [newGroup]
          };
          previousSteps[previousSteps.length - 1].subSteps.push({ operator: stepOperator, state: JSON.parse(JSON.stringify(equations)) });
          mergeTokensInGroup(equations[equationIndex]);
        }
        break;
      }
      case InputOperator.SIMPLIFY: {
        mergeTokensInGroup(equations[equationIndex]);
        break;
      }
    }
  }
}

const getGCD = (x: number, y: number): number => (!y ? x : getGCD(y, x % y));

const getLCM = (...arr: number[]) => {
  const _lcm = (x: number, y: number): number => (x * y) / getGCD(x, y);
  return [...arr].reduce((a, b) => _lcm(a, b));
};

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
  NONE,
  ADD,
  SUBTRACT,
  MULTIPLY,
  DIVIDE,
  EXPONENT,
  SIMPLIFY
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
    const tokens = props.step.state.map(equation => {
      return TokenGroupComponent({ group: equation, noParens: true, algorithmStep: props.step }).join(' ');
    }).join(' = ');
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

  useEffect(() => {
    window['Module']._initialize();
    setTokenString(window['Module'].UTF8ToString(window['Module']._getTokenString()));
  }, []);

  useEffect(() => {
    process.env.NODE_ENV === 'development' && console.log(equations);
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
      process.env.NODE_ENV === 'development' && console.log(event.key);
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
              process.env.NODE_ENV === 'development' && console.log(currentInput);
              applyOperator(currentInput);
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
  process.env.NODE_ENV === 'development' && console.log(tokenString);
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
                      equations.push({ type: TokenType.GROUP_ADD, id: nextTokenId++, tokens: [{ type: TokenType.PRIMITIVE_NUMBER, id: nextTokenId++, value: 1 }] });
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
