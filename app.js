(() => {
  const exprEl = document.getElementById("expression");
  const resultEl = document.getElementById("result");
  const pill = document.getElementById("historyPill");
  const pillText = document.getElementById("pillText");
  const panel = document.getElementById("historyPanel");
  const list = document.getElementById("historyList");
  const clearHistoryBtn = document.getElementById("clearHistory");

  const OPS = ["+", "-", "*", "/"];
  const SYMBOL = { "+": "+", "-": "−", "*": "×", "/": "÷" };
  const MAX_HISTORY = 20;

  let expr = "";            // internal expression, e.g. "12+3*4"
  let justEvaluated = false;
  let history = loadHistory();

  // ---------- Evaluation (no eval) ----------
  function tokenize(str) {
    const tokens = [];
    let i = 0;
    while (i < str.length) {
      const ch = str[i];
      const prev = tokens[tokens.length - 1];
      const unary = ch === "-" && (prev === undefined || OPS.includes(prev));
      if (/[\d.]/.test(ch) || unary) {
        let num = unary ? "-" : "";
        if (unary) i++;
        while (i < str.length && /[\d.]/.test(str[i])) num += str[i++];
        if (i < str.length && (str[i] === "e" || str[i] === "E")) {
          num += str[i++];
          if (str[i] === "+" || str[i] === "-") num += str[i++];
          while (i < str.length && /\d/.test(str[i])) num += str[i++];
        }
        if (num === "-" || num === "") throw new Error("Bad number");
        tokens.push(parseFloat(num));
      } else if (OPS.includes(ch)) {
        tokens.push(ch);
        i++;
      } else {
        throw new Error("Bad token");
      }
    }
    return tokens;
  }

  function evaluate(str) {
    const tokens = tokenize(str);
    if (!tokens.length || typeof tokens[tokens.length - 1] !== "number") throw new Error("Incomplete");

    // Pass 1: * and /
    const stack = [tokens[0]];
    for (let i = 1; i < tokens.length; i += 2) {
      const op = tokens[i], n = tokens[i + 1];
      if (op === "*") stack[stack.length - 1] *= n;
      else if (op === "/") {
        if (n === 0) throw new Error("Cannot divide by 0");
        stack[stack.length - 1] /= n;
      } else stack.push(op, n);
    }
    // Pass 2: + and -
    let total = stack[0];
    for (let i = 1; i < stack.length; i += 2) {
      total = stack[i] === "+" ? total + stack[i + 1] : total - stack[i + 1];
    }
    if (!isFinite(total)) throw new Error("Overflow");
    return parseFloat(total.toPrecision(12)); // tame float noise (0.1+0.2)
  }

  // ---------- Formatting ----------
  function formatNumber(n) {
    if (Math.abs(n) >= 1e15 || (Math.abs(n) < 1e-9 && n !== 0)) return n.toExponential(6).replace(/\.?0+e/, "e");
    const [int, dec] = String(n).split(".");
    const grouped = Number(int).toLocaleString("en-US");
    return dec !== undefined ? `${int === "-0" ? "-0" : grouped}.${dec}` : grouped;
  }

  function prettyExpr(str) {
    return tokenizeLoose(str)
      .map(t => (OPS.includes(t) ? ` ${SYMBOL[t]} ` : formatOperand(t)))
      .join("");
  }

  // Splits without validating, so partial input like "12." or "5+" renders fine
  function tokenizeLoose(str) {
    return str.match(/(^-|(?<=[+\-*/])-)?[\d.]+(?:e[+\-]?\d+)?|[+\-*/]/gi) || [];
  }

  function formatOperand(s) {
    if (s === "-") return "−";
    const neg = s.startsWith("-");
    const body = neg ? s.slice(1) : s;
    const [int, dec] = body.split(".");
    const grouped = int === "" ? "" : Number(int).toLocaleString("en-US");
    return (neg ? "−" : "") + grouped + (dec !== undefined ? "." + dec : "");
  }

  // ---------- Input handling ----------
  const lastChar = () => expr.slice(-1);
  const currentNumber = () => (expr.match(/-?[\d.]*$/) || [""])[0];

  function inputDigit(d) {
    if (justEvaluated) { expr = ""; justEvaluated = false; }
    const cur = currentNumber().replace("-", "");
    if (cur === "0") expr = expr.slice(0, -1); // replace leading zero
    if (cur.replace(".", "").length >= 15) return;
    expr += d;
  }

  function inputDecimal() {
    if (justEvaluated) { expr = ""; justEvaluated = false; }
    const cur = currentNumber();
    if (cur.includes(".")) return;
    expr += cur === "" || cur === "-" ? "0." : ".";
  }

  function inputOperator(op) {
    justEvaluated = false;
    if (expr === "" || expr === "-") {
      if (op === "-") expr = "-"; // allow negative first number
      return;
    }
    if (lastChar() === ".") expr = expr.slice(0, -1);
    if (OPS.includes(lastChar())) {
      // "5*" + "-" → negative operand; otherwise replace operator
      const prev = expr.slice(-2, -1);
      if (op === "-" && (lastChar() === "*" || lastChar() === "/")) { expr += "-"; return; }
      expr = expr.slice(0, OPS.includes(prev) ? -2 : -1);
    }
    expr += op;
  }

  function percent() {
    const cur = currentNumber();
    if (!cur || cur === "-" ) return;
    const val = parseFloat((parseFloat(cur) / 100).toPrecision(12));
    expr = expr.slice(0, expr.length - cur.length) + String(val);
    justEvaluated = false;
  }

  function backspace() {
    if (justEvaluated) { clearAll(); return; }
    expr = expr.slice(0, -1);
  }

  function clearAll() {
    expr = "";
    justEvaluated = false;
  }

  function equals() {
    let e = expr;
    while (e && (OPS.includes(e.slice(-1)) || e.slice(-1) === ".")) e = e.slice(0, -1);
    if (!e || !OPS.some(op => e.slice(1).includes(op))) return; // nothing to compute
    try {
      const value = evaluate(e);
      addHistory(prettyExpr(e), value);
      exprEl.textContent = prettyExpr(e) + " =";
      expr = String(value);
      justEvaluated = true;
      render(true);
    } catch (err) {
      showError(err.message);
    }
  }

  // ---------- Rendering ----------
  function setResult(text, isError = false) {
    resultEl.textContent = text;
    resultEl.classList.toggle("error", isError);
    resultEl.classList.toggle("small", text.length > 9 && text.length <= 13);
    resultEl.classList.toggle("xsmall", text.length > 13);
  }

  function render(keepExpr = false) {
    if (justEvaluated) {
      setResult(formatNumber(parseFloat(expr)));
    } else {
      if (!keepExpr) exprEl.textContent = "";
      setResult(expr ? prettyExpr(expr) || "0" : "0");
      // live preview of the answer
      try {
        const e = expr.replace(/[+\-*/.]+$/, "");
        if (e && OPS.some(op => e.slice(1).includes(op))) exprEl.textContent = "= " + formatNumber(evaluate(e));
      } catch { /* incomplete or invalid: no preview */ }
    }
    highlightOperator();
  }

  function showError(msg) {
    exprEl.textContent = prettyExpr(expr);
    setResult(msg, true);
    expr = "";
    justEvaluated = false;
  }

  function highlightOperator() {
    document.querySelectorAll(".key.op").forEach(k =>
      k.classList.toggle("active", !justEvaluated && k.dataset.op === lastChar())
    );
  }

  // ---------- History ----------
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem("calc-history")) || []; }
    catch { return []; }
  }

  function saveHistory() {
    try { localStorage.setItem("calc-history", JSON.stringify(history)); } catch { /* ignore */ }
  }

  function addHistory(exprText, value) {
    history.unshift({ expr: exprText, value });
    history = history.slice(0, MAX_HISTORY);
    saveHistory();
    renderHistory();
  }

  function renderHistory() {
    const latest = history[0];
    pillText.textContent = latest ? `${latest.expr} = ${formatNumber(latest.value)}` : "No history";

    list.innerHTML = "";
    if (!history.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "No calculations yet";
      list.appendChild(li);
      return;
    }
    history.forEach(item => {
      const li = document.createElement("li");
      li.title = "Use this result";
      const ex = document.createElement("div");
      ex.className = "h-expr";
      ex.textContent = item.expr + " =";
      const res = document.createElement("div");
      res.className = "h-res";
      res.textContent = formatNumber(item.value);
      li.append(ex, res);
      li.addEventListener("click", () => {
        expr = String(item.value);
        justEvaluated = true;
        exprEl.textContent = item.expr + " =";
        render(true);
        togglePanel(false);
      });
      list.appendChild(li);
    });
  }

  function togglePanel(force) {
    const open = force ?? panel.hidden;
    panel.hidden = !open;
    pill.setAttribute("aria-expanded", String(open));
  }

  pill.addEventListener("click", e => { e.stopPropagation(); togglePanel(); });
  panel.addEventListener("click", e => e.stopPropagation());
  document.addEventListener("click", () => togglePanel(false));
  clearHistoryBtn.addEventListener("click", () => {
    history = [];
    saveHistory();
    renderHistory();
  });

  // ---------- Dispatch ----------
  function handle(btn) {
    const { num, op, action } = btn.dataset;
    if (num !== undefined) inputDigit(num);
    else if (op) inputOperator(op);
    else if (action === "decimal") inputDecimal();
    else if (action === "clear") clearAll();
    else if (action === "backspace") backspace();
    else if (action === "percent") percent();
    else if (action === "equals") return equals();
    render();
  }

  document.querySelector(".keys").addEventListener("click", e => {
    const btn = e.target.closest(".key");
    if (btn) { handle(btn); btn.blur(); }
  });

  const KEY_ALIASES = { "=": "Enter", Delete: "Escape", x: "*", X: "*", ",": "." };

  document.addEventListener("keydown", e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape" && !panel.hidden) { togglePanel(false); return; }
    const key = KEY_ALIASES[e.key] || e.key;
    const btn = document.querySelector(`.key[data-key="${CSS.escape(key)}"]`);
    if (!btn) return;
    e.preventDefault();
    btn.classList.add("pressed");
    setTimeout(() => btn.classList.remove("pressed"), 100);
    handle(btn);
  });

  renderHistory();
  render();
})();
