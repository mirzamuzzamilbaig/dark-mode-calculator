# Dark-Mode Calculator

A sleek, dependency-free dark-mode calculator web app built with vanilla HTML, CSS, and JavaScript.

## Features

- **Order-of-operations parser (no `eval`)** — evaluates `×` and `÷` before `+` and `−`, handles scientific notation chaining, and avoids floating-point rounding noise (`0.1 + 0.2 = 0.3`).
- **Live result preview** — displays the running answer as you type an expression.
- **Persistent calculation history** — click the top history pill to view up to 20 saved calculations (stored in `localStorage`) or reuse any past result.
- **Full keyboard support** — digits `0–9`, `+ - * /` (or `x`), `.` (or `,`), `Enter` / `=`, `Backspace`, and `Esc` / `Delete`.

## Usage

Open `index.html` directly in any modern browser — no build step or dependencies required.
