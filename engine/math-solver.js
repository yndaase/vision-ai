/**
 * Vision AI — Math Expression Solver (built from scratch)
 * Parses and evaluates mathematical expressions without eval().
 * Supports: +, -, *, /, ^, parentheses, basic functions.
 */

class MathSolver {
  /**
   * Tokenize a math expression into tokens
   */
  _lex(expr) {
    const tokens = [];
    let i = 0;
    const str = expr.replace(/\s+/g, '');
    while (i < str.length) {
      // Number
      if (/[0-9.]/.test(str[i])) {
        let num = '';
        while (i < str.length && /[0-9.]/.test(str[i])) num += str[i++];
        tokens.push({ type: 'num', val: parseFloat(num) });
      }
      // Function names or variable x
      else if (/[a-zA-Z]/.test(str[i])) {
        let name = '';
        while (i < str.length && /[a-zA-Z]/.test(str[i])) name += str[i++];
        tokens.push({ type: 'fn', val: name.toLowerCase() });
      }
      // Operators
      else if (/[+\-*/^()]/.test(str[i])) {
        tokens.push({ type: 'op', val: str[i++] });
      } else {
        i++; // skip unknown
      }
    }
    return tokens;
  }

  /**
   * Shunting Yard Algorithm → Reverse Polish Notation
   */
  _toRPN(tokens) {
    const output = [];
    const ops = [];
    const precedence = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };
    const rightAssoc = new Set(['^']);
    const funcs = new Set(['sin','cos','tan','sqrt','log','abs','ceil','floor']);

    for (const tok of tokens) {
      if (tok.type === 'num') {
        output.push(tok);
      } else if (tok.type === 'fn' && funcs.has(tok.val)) {
        ops.push(tok);
      } else if (tok.type === 'op' && tok.val !== '(' && tok.val !== ')') {
        const prec = precedence[tok.val];
        while (ops.length) {
          const top = ops[ops.length - 1];
          if (!top || top.val === '(') break;
          const topPrec = precedence[top.val] || 0;
          if (topPrec > prec || (topPrec === prec && !rightAssoc.has(tok.val))) {
            output.push(ops.pop());
          } else break;
        }
        ops.push(tok);
      } else if (tok.val === '(') {
        ops.push(tok);
      } else if (tok.val === ')') {
        while (ops.length && ops[ops.length - 1].val !== '(') {
          output.push(ops.pop());
        }
        ops.pop(); // remove '('
        if (ops.length && ops[ops.length - 1].type === 'fn') {
          output.push(ops.pop());
        }
      }
    }
    while (ops.length) output.push(ops.pop());
    return output;
  }

  /**
   * Evaluate RPN stack
   */
  _evalRPN(rpn) {
    const stack = [];
    const mathFns = {
      sin: Math.sin, cos: Math.cos, tan: Math.tan,
      sqrt: Math.sqrt, log: Math.log, abs: Math.abs,
      ceil: Math.ceil, floor: Math.floor,
    };

    for (const tok of rpn) {
      if (tok.type === 'num') {
        stack.push(tok.val);
      } else if (tok.type === 'fn') {
        const fn = mathFns[tok.val];
        if (fn) stack.push(fn(stack.pop()));
      } else if (tok.type === 'op') {
        const b = stack.pop(), a = stack.pop();
        switch (tok.val) {
          case '+': stack.push(a + b); break;
          case '-': stack.push(a - b); break;
          case '*': stack.push(a * b); break;
          case '/': stack.push(b !== 0 ? a / b : NaN); break;
          case '^': stack.push(Math.pow(a, b)); break;
        }
      }
    }
    return stack[0];
  }

  /**
   * Try to solve a simple linear equation like "2x + 5 = 13"
   * Returns { x, steps }
   */
  solveLinear(expr) {
    // Extract left and right side of equation
    const sides = expr.split('=');
    if (sides.length !== 2) return null;

    let [lhs, rhs] = sides.map(s => s.trim());
    const steps = [`Given: ${lhs} = ${rhs}`];

    // Parse coefficients using regex: ax + b = c form
    const varMatch = lhs.match(/([+-]?\s*\d*\.?\d*)\s*x\s*([+-]\s*\d+\.?\d*)?/i);
    if (!varMatch) return null;

    let coeff = parseFloat((varMatch[1] || '1').replace(/\s/g, '')) || 1;
    let constant = parseFloat((varMatch[2] || '0').replace(/\s/g, '')) || 0;
    let rhsVal = this.evaluate(rhs);

    steps.push(`Isolate x: ${coeff}x = ${rhsVal} - ${constant}`);
    const result = (rhsVal - constant) / coeff;
    steps.push(`x = ${rhsVal - constant} / ${coeff}`);
    steps.push(`x = ${result}`);

    return { x: result, steps };
  }

  /**
   * Evaluate a pure numeric expression string
   * @param {string} expr
   * @returns {number|null}
   */
  evaluate(expr) {
    try {
      const tokens = this._lex(String(expr));
      const rpn = this._toRPN(tokens);
      return this._evalRPN(rpn);
    } catch {
      return null;
    }
  }

  /**
   * Detect if a query is a math problem and solve it
   * @param {string} query
   * @returns {{ answer: string, steps: string[], isMath: boolean }}
   */
  solve(query) {
    const q = query.trim();

    // Check for equation with variable
    if (/[a-z]\s*[=+\-*/]/.test(q) && q.includes('=')) {
      const result = this.solveLinear(q);
      if (result !== null) {
        return {
          isMath: true,
          answer: `x = ${result.x}`,
          steps: result.steps,
        };
      }
    }

    // Pure numeric expression
    const pureNumeric = /^[\d\s+\-*/^().a-z]+$/.test(q.toLowerCase());
    if (pureNumeric) {
      const val = this.evaluate(q);
      if (val !== null && !isNaN(val)) {
        const rounded = Math.round(val * 1e10) / 1e10;
        return {
          isMath: true,
          answer: String(rounded),
          steps: [`Expression: ${q}`, `Result: ${rounded}`],
        };
      }
    }

    return { isMath: false };
  }
}

module.exports = { MathSolver };
