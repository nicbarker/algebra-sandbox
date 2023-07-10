import Head from "next/head";
import React from "react";
import styles from "../styles/Home.module.css";
import nextPackage from "package.json";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { MathJax, MathJaxContext } from "better-react-mathjax";
import classnames from "classnames";

function debugOutput(...data: any[]) {
  if (process.env.NODE_ENV === 'development') {
    console.log(data);
  }
}

enum GameOperatorType {
  ADD,
  SUBTRACT,
  DIVIDE,
  MULTIPLY,
  SQUARE,
  ROOT,
  SIMPLIFY
}

type GameOperator = {
  type: GameOperatorType,
  numeral: string,
  value: number
}

function getPronumeralTokenGroup(multiplier: number, numeral: string): TokenGroupMul {
  return {
    type: TokenType.GROUP_MUL,
    tokens: [{
      type: TokenType.PRIMITIVE_NUMBER,
      value: multiplier,
    },
    {
      type: TokenType.PRIMITIVE_PRONUMERAL,
      numeral,
    }]
  }
}

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
  tokens: Token[],
}

type TokenGroupMul = {
  type: TokenType.GROUP_MUL,
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
  value: number
}

type TokenPrimitivePronumeral = {
  type: TokenType.PRIMITIVE_PRONUMERAL,
  numeral: string
}

type TokenPrimitive = TokenPrimitiveNumber | TokenPrimitivePronumeral;

type Token = TokenGroup | TokenPrimitive;

let testTokens: TokenGroupAdd = {
  type: TokenType.GROUP_ADD,
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
    { type: TokenType.PRIMITIVE_NUMBER, value: 1 }
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

type AlgorithmStep = {
  operator: InputOperatorObject,
  state: TokenGroupAdd
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

function TokenGroupComponent(group: TokenGroup, noParens?: boolean): string[] {
  let toReturn: string[] = [];
  if (group.type === TokenType.GROUP_ADD || group.type === TokenType.GROUP_MUL) {
    const parens = group.tokens.length > 1 && !noParens && group.type === TokenType.GROUP_ADD;
    if (parens) toReturn.push('(')
    for (let i = 0; i < group.tokens.length; i++) {
      const token = group.tokens[i];
      if (token.type === TokenType.PRIMITIVE_NUMBER) {
        if (group.type === TokenType.GROUP_MUL && Math.abs(token.value) === 1) {
          continue;
        }
        if (i > 0) {
          toReturn.push(token.value >= 0 ? '+' : '-');
        }
        toReturn.push(Math.abs(token.value).toString());
      } else if (token.type === TokenType.PRIMITIVE_PRONUMERAL) {
        if (group.type === TokenType.GROUP_ADD && i > 0) toReturn.push("+");
        toReturn.push(token.numeral);
      } else {
        const sign = getSignOfTokenGroup(token);
        if ((i > 0 && group.type === TokenType.GROUP_ADD) || sign === '-') {
          toReturn.push(sign)
        }
        toReturn = toReturn.concat(TokenGroupComponent(token));
      }
    }
    if (parens) toReturn.push(')')
  } else if (group.type === TokenType.GROUP_DIV) {
    toReturn = toReturn.concat('{', TokenGroupComponent(group.numerator, true), '\\over', TokenGroupComponent(group.denominator, true), '}')
  } else if (group.type === TokenType.GROUP_POW) {
    let base = TokenGroupComponent(group.base);
    // When an exponent has anything other than a primitive base needs to be wrapped in parens to make it clear
    if (group.base.tokens.length > 1 || isGroupToken(group.base.tokens[0])) {
      base = ['(', ...base, ')'];
    }
    toReturn = toReturn.concat(base, '^', '{', TokenGroupComponent(group.exponent, true), '}')
  }
  return toReturn;
}

function findLikeTermsInToken(token: Token) {
  let terms: string[] = []
  switch (token.type) {
    case TokenType.PRIMITIVE_NUMBER: {
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
      for (const subToken of token.base.tokens) {
        terms = terms.concat(findLikeTermsInToken(subToken));
      }
      for (const subToken of token.exponent.tokens) {
        terms = terms.concat(findLikeTermsInToken(subToken));
      }
      break;
    }
    case TokenType.GROUP_DIV:
    case TokenType.GROUP_ADD: {
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
                token.tokens.splice(j, 1, { type: TokenType.PRIMITIVE_NUMBER, value: 1 });
                j--;
              }
              break;
            }
            case TokenType.GROUP_POW: {
              if (mulToken.base.tokens.length === 1 && mulToken.base.tokens[0].type === TokenType.PRIMITIVE_PRONUMERAL && factors.numerals.includes(mulToken.base.tokens[0].numeral)) {
                mulToken.exponent.tokens.push({ type: TokenType.PRIMITIVE_NUMBER, value: -1 });
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
          group.tokens.splice(i, 1, { type: TokenType.PRIMITIVE_NUMBER, value: 1 });
          i--;
        }
        break;
      }
      case TokenType.GROUP_POW: {
        if (token.base.tokens.length === 1 && token.base.tokens[0].type === TokenType.PRIMITIVE_PRONUMERAL && factors.numerals.includes(token.base.tokens[0].numeral)) {
          token.exponent.tokens.push({ type: TokenType.PRIMITIVE_NUMBER, value: -1 });
        }
        break;
      }
    }
  }
}

function multiplyPrimitivePrimitive(token1: TokenPrimitive, token2: TokenPrimitive) {
  if (token1.type === TokenType.PRIMITIVE_NUMBER && token2.type === TokenType.PRIMITIVE_NUMBER) {
    token1.value *= token2.value;
    return token1;
  } else if (token1.type === TokenType.PRIMITIVE_PRONUMERAL && token2.type === TokenType.PRIMITIVE_PRONUMERAL && token1.numeral === token2.numeral) {
    return {
      type: TokenType.GROUP_POW,
      base: { type: TokenType.GROUP_ADD, tokens: [token1] },
      exponent: { type: TokenType.GROUP_ADD, tokens: [{ type: TokenType.PRIMITIVE_NUMBER, value: 2 }] }
    } as TokenGroupPow
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
  const toReturn: TokenGroupAdd = { type: TokenType.GROUP_ADD, tokens: [] }
  for (var i = 0; i < addGroup.tokens.length; i++) {
    toReturn.tokens[i] = {
      type: TokenType.GROUP_MUL,
      tokens: [
        primitive,
        addGroup.tokens[i]
      ]
    }
  }
  return toReturn;
}

function multiplyAddMul(addGroup: TokenGroupAdd, mulGroup: TokenGroupMul) {
  const toReturn: TokenGroupAdd = { type: TokenType.GROUP_ADD, tokens: [] }
  for (var i = 0; i < addGroup.tokens.length; i++) {
    toReturn.tokens[i] = {
      type: TokenType.GROUP_MUL,
      tokens: [
        ...mulGroup.tokens,
        addGroup.tokens[i]
      ]
    }
  }
  return toReturn;
}

function multiplyAddAdd(groupOne: TokenGroupAdd, groupTwo: TokenGroupAdd) {
  const toReturn: TokenGroupAdd = { type: TokenType.GROUP_ADD, tokens: [] }
  for (var i = 0; i < groupOne.tokens.length; i++) {
    for (var j = 0; j < groupTwo.tokens.length; j++) {
      toReturn.tokens[i] = {
        type: TokenType.GROUP_MUL,
        tokens: [
          groupOne.tokens[i],
          groupTwo.tokens[j]
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
    powGroup.exponent.tokens.push({ type: TokenType.PRIMITIVE_NUMBER, value: 1 })
    return powGroup;
  }
}

function multiplyPowAdd(powGroup: TokenGroupPow, addGroup: TokenGroupAdd) {
  const toReturn: TokenGroupAdd = { type: TokenType.GROUP_ADD, tokens: [] }
  for (var i = 0; i < addGroup.tokens.length; i++) {
    toReturn.tokens[i] = {
      type: TokenType.GROUP_MUL,
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

// TODO implement mul for exponents
function multiply(token1: Token, token2: Token): Token | undefined {
  debugOutput('multiply: ', JSON.parse(JSON.stringify(token1)), JSON.parse(JSON.stringify(token2)));
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
  debugOutput(`WARNING: Unimplemented multiply case fell through: `, JSON.parse(JSON.stringify(token1)), JSON.parse(JSON.stringify(token2)));
}

function addPrimitivePrimitive(token1: TokenPrimitive, token2: TokenPrimitive) {
  if (token1.type !== token2.type) {
    return undefined;
  }
  if (token1.type === TokenType.PRIMITIVE_NUMBER) {
    token1.value += (token2 as TokenPrimitiveNumber).value;
    return token1;
  }
  if (token1.type === TokenType.PRIMITIVE_PRONUMERAL) {
    const newToken: TokenGroupMul = {
      type: TokenType.GROUP_MUL,
      tokens: [
        { type: TokenType.PRIMITIVE_NUMBER, value: 2 },
        token1
      ]
    };
    return newToken;
  }
}

function addMulPrimitive(mulGroup: TokenGroupMul, token2: TokenPrimitive) {
  if (token2.type === TokenType.PRIMITIVE_NUMBER) {
    return;
  }
  if (mulGroup.tokens.length === 2 && mulGroup.tokens.find((t): t is TokenPrimitivePronumeral => t.type === TokenType.PRIMITIVE_PRONUMERAL)?.numeral === token2.numeral) {
    const token = mulGroup.tokens.find((t): t is TokenPrimitiveNumber => t.type === TokenType.PRIMITIVE_NUMBER) as TokenPrimitiveNumber;
    token.value += 1;
    return mulGroup;
  }
}

// TODO: this is very primitive and won't even work with 6xy format groups
function addMulMul(group1: TokenGroupMul, group2: TokenGroupMul) {
  if (group1.tokens.length === 2 && group2.tokens.length === 2) {
    const numeral1 = group1.tokens.find((t): t is TokenPrimitivePronumeral => t.type === TokenType.PRIMITIVE_PRONUMERAL);
    const numeral2 = group2.tokens.find((t): t is TokenPrimitivePronumeral => t.type === TokenType.PRIMITIVE_PRONUMERAL);
    if (numeral1 && numeral1.numeral === numeral2?.numeral) {
      const token1 = group1.tokens.find((t): t is TokenPrimitiveNumber => t.type === TokenType.PRIMITIVE_NUMBER) as TokenPrimitiveNumber;
      const token2 = group2.tokens.find((t): t is TokenPrimitiveNumber => t.type === TokenType.PRIMITIVE_NUMBER) as TokenPrimitiveNumber;
      if (token1 && token2) {
        token1.value += token2.value;
        return group1;
      }
    }
  }
}

function canAddTerms(token1: Token, token2: Token) {
  const likeTerms1 = findLikeTermsInToken(token1);
  const likeTerms2 = findLikeTermsInToken(token2);
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
  debugOutput('add: ', JSON.parse(JSON.stringify(token1)), JSON.parse(JSON.stringify(token2)));
  debugOutput("Like terms:", findLikeTermsInToken(token1), findLikeTermsInToken(token2));
  const canAdd = canAddTerms(token1, token2);
  debugOutput("Can add:", canAdd);
  if (!canAdd) {
    return undefined;
  }
  switch (token1.type) {
    case TokenType.PRIMITIVE_NUMBER: {
      switch (token2.type) {
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
        case TokenType.PRIMITIVE_PRONUMERAL:
        case TokenType.PRIMITIVE_NUMBER: { // PRIMITIVE + PRIMITIVE -
          return addMulPrimitive(token1, token2);
        }
      }
    }
  }
}

function mergeRedundantTokensUpwardsIntoParent(group: TokenGroup, token: Token) {
  debugOutput('checking merge', token)
  if (!isGroupToken(token)) {
    return false;
  }
  switch (group.type) {
    case TokenType.GROUP_MUL:
    case TokenType.GROUP_ADD: {
      const index = group.tokens.findIndex(t => t === token);
      switch (token.type) {
        case TokenType.GROUP_MUL:
        case TokenType.GROUP_ADD: {
          if (token.tokens.length === 0) {
            debugOutput("remove length 0");
            group.tokens.splice(index, 1);
            return true;
          }
          if (token.tokens.length === 1) {
            debugOutput("merge length 1");
            group.tokens.splice(index, 1, token.tokens[0]);
            return true;
          }
          if (group.type === token.type) {
            debugOutput("merge same type");
            group.tokens = [...group.tokens.slice(0, index), ...token.tokens, ...group.tokens.slice(index + 1)];
            return true;
          }
          if (token.type === TokenType.GROUP_MUL && token.tokens.find(t => t.type === TokenType.PRIMITIVE_NUMBER && t.value === 0)) {
            debugOutput("remove multiply by zero");
            group.tokens.splice(index, 1);
            return true;
          }
          break;
        }
        case TokenType.GROUP_DIV: {
          if (token.numerator.tokens[0].type === TokenType.PRIMITIVE_NUMBER && token.numerator.tokens[0].value === 0) { // Numerator is 0
            debugOutput("removing NUMERATOR 0")
            group.tokens.splice(index, 1);
            return true;
          } else if (token.denominator.tokens.length === 0 || (token.denominator.tokens.length === 1 && token.denominator.tokens[0].type === TokenType.PRIMITIVE_NUMBER && token.denominator.tokens[0].value === 1)) {
            debugOutput('removing DENOM 1')
            group.tokens.splice(index, 1, token.numerator);
            return true;
          }
          break;
        }
        case TokenType.GROUP_POW: {
          if (token.exponent.tokens.length === 1 && token.exponent.tokens[0].type === TokenType.PRIMITIVE_NUMBER && token.exponent.tokens[0].value === 1) {
            debugOutput('removing POW 1')
            group.tokens.splice(index, 1, token.base);
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
      for (let i = 0; i < group.tokens.length; i++) {
        for (let j = i + 1; j < group.tokens.length; j++) {
          const result = multiply(group.tokens[i], group.tokens[j]);
          if (result) {
            debugOutput('multiply result:', JSON.parse(JSON.stringify(result)))
            group.tokens.splice(j, 1);
            group.tokens.splice(i, 1, result);
            if (isGroupToken(group.tokens[i])) {
              mergeTokensInGroup(group.tokens[i] as TokenGroup);
            }
            mergeRedundantTokensUpwardsIntoParent(group, group.tokens[i]);
            i = 0;
            break;
          } else {
            debugOutput('multiply had no effect');
          }
        }
        if (isGroupToken(group.tokens[i])) {
          mergeTokensInGroup(group.tokens[i] as TokenGroup);
          mergeRedundantTokensUpwardsIntoParent(group, group.tokens[i]);
        }
      }
      break;
    }
    case TokenType.GROUP_DIV: {
      mergeTokensInGroup(group.numerator);
      mergeTokensInGroup(group.denominator);
      const numeratorFactors = findCommonFactorsInAddGroup(group.numerator);
      const denominatorFactors = findCommonFactorsInAddGroup(group.denominator);
      const gcd = getGCD(numeratorFactors.number, denominatorFactors.number)
      const pronumeralCrossover = numeratorFactors.numerals.filter(n => denominatorFactors.numerals.includes(n));
      if (gcd > 0 || pronumeralCrossover.length > 0) {
        debugOutput('extracting common factors', { number: gcd, numerals: pronumeralCrossover });
        extractCommonFactorsInAddGroup(group.numerator, { number: gcd, numerals: pronumeralCrossover });
        extractCommonFactorsInAddGroup(group.denominator, { number: gcd, numerals: pronumeralCrossover });
        debugOutput("NUMERATOR---")
        mergeTokensInGroup(group.numerator);
        debugOutput("DENOMINATOR---")
        mergeTokensInGroup(group.denominator);
      }
      break;
    }
    case TokenType.GROUP_ADD: {
      for (let i = 0; i < group.tokens.length - 1; i++) {
        for (let j = i + 1; j < group.tokens.length; j++) {
          debugOutput("add", group.tokens[i], group.tokens[j])
          const result = add(group.tokens[i], group.tokens[j]);
          if (result) {
            debugOutput("add result", JSON.parse(JSON.stringify(result)))
            group.tokens.splice(j, 1);
            group.tokens.splice(i, 1, result);
            if (isGroupToken(group.tokens[i])) {
              mergeTokensInGroup(group.tokens[i] as TokenGroup);
            }
            mergeRedundantTokensUpwardsIntoParent(group, group.tokens[i]);
            i = 0;
            break;
          } else {
            debugOutput("add had no effect")
          }
        }
      }
      for (let i = 0; i < group.tokens.length; i++) {
        const token = group.tokens[i];
        if (isGroupToken(token)) {
          mergeTokensInGroup(token);
          if (mergeRedundantTokensUpwardsIntoParent(group, token)) {
            debugOutput('redundant');
            i--;
          }
        } else if (token.type === TokenType.PRIMITIVE_NUMBER && token.value === 0) {
          group.tokens.splice(i, 1);
          i--;
        }
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
  debugOutput('-------------------------------------------------------------------------')
  const previousTokens = JSON.parse(JSON.stringify(testTokens));
  let handled = false;
  switch (operator.operator) {
    case InputOperator.ADD:
    case InputOperator.SUBTRACT: {
      const numberGroup: TokenPrimitiveNumber = { type: TokenType.PRIMITIVE_NUMBER, value: operator.value! };
      const pronumeralGroup: TokenPrimitivePronumeral = { type: TokenType.PRIMITIVE_PRONUMERAL, numeral: operator.numeral! };
      const mulGroup = operator.value !== 1 ? { type: TokenType.GROUP_MUL, tokens: [numberGroup, pronumeralGroup] } as TokenGroupMul : pronumeralGroup;
      testTokens.tokens.push(!operator.numeral ? numberGroup : mulGroup);
      mergeTokensInGroup(testTokens);
      handled = true;
      break;
    }
    case InputOperator.MULTIPLY: {
      for (let i = 0; i < testTokens.tokens.length; i++) {
        const pronumeralGroup = !operator.numeral ? { type: TokenType.PRIMITIVE_NUMBER, value: operator.value } as TokenPrimitiveNumber : { type: TokenType.PRIMITIVE_PRONUMERAL, numeral: operator.numeral } as TokenPrimitivePronumeral;
        const token = testTokens.tokens[i];
        const newGroup: TokenGroupMul = {
          type: TokenType.GROUP_MUL,
          tokens: [
            !operator.numeral ? pronumeralGroup : token,
            !operator.numeral ? token : pronumeralGroup,
          ]
        };
        testTokens.tokens.splice(i, 1, newGroup);
        mergeTokensInGroup(testTokens);
      }
      handled = true;
      break;
    }
    case InputOperator.DIVIDE: {
      for (let i = 0; i < testTokens.tokens.length; i++) {
        const pronumeralGroup = !operator.numeral ? { type: TokenType.PRIMITIVE_NUMBER, value: operator.value } as TokenPrimitiveNumber : { type: TokenType.PRIMITIVE_PRONUMERAL, numeral: operator.numeral } as TokenPrimitivePronumeral;
        const token = testTokens.tokens[i];
        // DIV is just a multiply by reciprocal
        const newGroup: TokenGroupMul = {
          type: TokenType.GROUP_MUL,
          tokens: [
            token,
            {
              type: TokenType.GROUP_DIV,
              numerator: {
                type: TokenType.GROUP_ADD,
                tokens: [{ type: TokenType.PRIMITIVE_NUMBER, value: 1 }]
              },
              denominator: {
                type: TokenType.GROUP_ADD,
                tokens: [pronumeralGroup]
              },
            }
          ]
        }
        testTokens.tokens.splice(i, 1, newGroup);
        mergeTokensInGroup(testTokens);
      }
      handled = true;
      break;
    }
  }

  if (handled) {
    previousSteps.push({ operator, state: previousTokens });
  }
}

const getGCD = (x: number, y: number): number => (!y ? x : getGCD(y, x % y));

const getLCM = (...arr: number[]) => {
  const _lcm = (x: number, y: number): number => (x * y) / getGCD(x, y);
  return [...arr].reduce((a, b) => _lcm(a, b));
};

function getOperatorLabel(operator: InputOperatorObject) {
  const value = `${operator.numeral || Math.abs(operator.value!)}`;
  switch (operator.operator) {
    case InputOperator.ADD: return `+ ${value}`;
    case InputOperator.SUBTRACT: return `- ${value}`;
    case InputOperator.MULTIPLY: return `\\times ${value}`;
    case InputOperator.DIVIDE: return `/ ${value}`;
  }
}

enum KeyInput {
  LEFT,
  RIGHT,
  UP,
  DOWN
}
let recentKeys: KeyInput[] = [];
let recentKeysTimer = -1;

let previousSteps: AlgorithmStep[] = [];
const quarterCircleForwardKeys = [KeyInput.DOWN, KeyInput.RIGHT];
const quarterCircleBackwardsKeys = [KeyInput.DOWN, KeyInput.LEFT];

enum InputOperator {
  NONE,
  ADD,
  SUBTRACT,
  MULTIPLY,
  DIVIDE
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

function PreviousToken(props: { step: AlgorithmStep, onClick: () => void }) {
  return useMemo(() => {
    debugOutput("recompute");
    const tokens = TokenGroupComponent(props.step.state, true).join(' ')
    return <Fragment>
      <div className={classnames(styles.left, styles.grey)} onClick={props.onClick}><MathJax>{'\\(' + tokens + '\\)'}</MathJax></div>
      <div className={classnames(styles.right, styles.grey)}><MathJax>{'\\(' + getOperatorLabel(props.step.operator) + '\\)'}</MathJax></div>
    </Fragment >
  }, [props.step]);
}

function App() {
  const [currentInput, setCurrentInput] = useState<InputOperatorObject>({ operator: InputOperator.NONE });
  const [reload, setReload] = useState<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    debugOutput(testTokens);
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
      debugOutput(event.key);
      switch (event.key) {
        case '+': currentInput.operator = InputOperator.ADD; handled = true; break;
        case '-': currentInput.operator = InputOperator.SUBTRACT; handled = true; break;
        case '*': currentInput.operator = InputOperator.MULTIPLY; handled = true; break;
        case '/': currentInput.operator = InputOperator.DIVIDE; handled = true; break;
        case 'Escape':
        case 'Backspace': {
          setCurrentInput({ operator: InputOperator.NONE });
          handled = true;
          break;
        }
        case 'Enter': {
          if (currentInput.operator !== InputOperator.NONE) {
            if (currentInput.value || currentInput.numeral) {
              debugOutput(currentInput);
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
    <PreviousToken key={i} step={s} onClick={() => {
      testTokens = previousSteps[i].state;
      previousSteps = previousSteps.slice(0, i);
      setReload(reload + 1)
    }}></PreviousToken>
  ));
  const tokens = TokenGroupComponent(testTokens, true).join(' ');
  debugOutput(tokens);
  return (
    <MathJaxContext>
      <div className={styles.App} role="main">
        <div className={styles.container}>
          <div className={styles.headerBar}>Algebra Sandbox</div>
          <div className={styles.tokenScrollContainer} ref={scrollRef}>
            <div className={styles.tokensOuter}>
              {previousTokens}
              <div className={styles.left}><MathJax>{testTokens.tokens.length === 0 ? 'done' : '\\(' + tokens + '\\)'}</MathJax></div>
              <div className={styles.right}>&lt;-</div>
            </div>
          </div>
          <div className={styles.inputIndicator}>
            {getInputLabelFromOperator(currentInput)}
          </div>
        </div>
      </div>
    </MathJaxContext>
  );
}

export default App;
