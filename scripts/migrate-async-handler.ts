import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

const FILES = [
  'server/api/bills.ts',
  'server/api/maintenance.ts',
  'server/api/users.ts',
  'server/api/communication.ts',
  'server/api/common-spaces.ts',
  'server/api/budgets.ts',
  'server/api/invoices.ts',
  'server/api/organizations.ts',
  'server/api/demo-management.ts',
  'server/api/dynamic-budgets.ts',
  'server/api/cleanup.ts',
  'server/api/cleanup-orphans.ts',
  'server/api/migration-endpoints.ts',
  'server/api/optimized-documents.ts',
  'server/api/pillars-suggestions.ts',
  'server/api/quality-metrics.ts',
  'server/api/trial-request.ts',
  'server/api/company-history.ts',
  'server/api/delayed-updates.ts',
  'server/api/ai-document-analysis.ts',
];

const HTTP_VERBS = new Set(['get', 'post', 'put', 'patch', 'delete', 'all', 'use']);

interface Edit {
  start: number;
  end: number;
  replacement: string;
  why: string;
}

function isAppRoute(node: ts.CallExpression): boolean {
  const exp = node.expression;
  if (!ts.isPropertyAccessExpression(exp)) return false;
  if (!ts.isIdentifier(exp.expression) || exp.expression.text !== 'app') return false;
  if (!ts.isIdentifier(exp.name)) return false;
  return HTTP_VERBS.has(exp.name.text);
}

function getStringLiteralValue(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

// A "label" property whose value is a static string and whose key is one of the
// vestigial labels we want to preserve via extraErrorFields.
function getStaticLabelProperty(prop: ts.ObjectLiteralElementLike): { key: string; value: string } | null {
  if (!ts.isPropertyAssignment(prop)) return null;
  const name = prop.name;
  let key: string | null = null;
  if (ts.isIdentifier(name)) key = name.text;
  else if (ts.isStringLiteral(name)) key = name.text;
  if (!key) return null;
  if (key !== '_error' && key !== 'error') return null;
  const val = getStringLiteralValue(prop.initializer);
  if (val === null) return null;
  // Only static labels (no error.message interpolation)
  if (val === 'Internal server error') return { key, value: val };
  return null;
}

// Check if catch body's terminal statement is the "send 500" we want
function analyzeCatchTerminal(stmt: ts.Statement): { errorMessage: string; extraFields: Array<{ key: string; value: string }> } | null {
  let expr: ts.Expression | undefined;
  if (ts.isExpressionStatement(stmt)) expr = stmt.expression;
  else if (ts.isReturnStatement(stmt)) expr = stmt.expression;
  if (!expr) return null;

  // Walk: res.status(500).json({...})
  if (!ts.isCallExpression(expr)) return null;
  const jsonCall = expr;
  const jsonAccess = jsonCall.expression;
  if (!ts.isPropertyAccessExpression(jsonAccess)) return null;
  if (!ts.isIdentifier(jsonAccess.name) || jsonAccess.name.text !== 'json') return null;
  const statusCall = jsonAccess.expression;
  if (!ts.isCallExpression(statusCall)) return null;
  const statusAccess = statusCall.expression;
  if (!ts.isPropertyAccessExpression(statusAccess)) return null;
  if (!ts.isIdentifier(statusAccess.expression) || statusAccess.expression.text !== 'res') return null;
  if (!ts.isIdentifier(statusAccess.name) || statusAccess.name.text !== 'status') return null;
  if (statusCall.arguments.length !== 1) return null;
  const statusArg = statusCall.arguments[0];
  if (!ts.isNumericLiteral(statusArg) || statusArg.text !== '500') return null;

  if (jsonCall.arguments.length !== 1) return null;
  const body = jsonCall.arguments[0];
  if (!ts.isObjectLiteralExpression(body)) return null;

  // Body must contain exactly one `message: 'literal'` and zero or more
  // preservable static label fields (collected as extraFields).
  let messageLiteral: string | null = null;
  const extraFields: Array<{ key: string; value: string }> = [];
  for (const prop of body.properties) {
    if (ts.isPropertyAssignment(prop)) {
      let key: string | null = null;
      if (ts.isIdentifier(prop.name)) key = prop.name.text;
      else if (ts.isStringLiteral(prop.name)) key = prop.name.text;
      if (key === 'message') {
        const val = getStringLiteralValue(prop.initializer);
        if (val === null) return null;
        if (messageLiteral !== null) return null;
        messageLiteral = val;
        continue;
      }
      const label = getStaticLabelProperty(prop);
      if (label) {
        extraFields.push(label);
        continue;
      }
      return null; // Unknown / non-preservable property — skip
    }
    return null; // spread, shorthand, etc — skip
  }
  if (messageLiteral === null) return null;
  return { errorMessage: messageLiteral, extraFields };
}

// Check if a statement is a "logging only" statement allowed before the terminal
function isAllowedLogStatement(stmt: ts.Statement, src: string): { logPrefix?: string } | null {
  // ExpressionStatement of console.error(...) / console.warn(...) / logError(...) / logWarn(...) / logInfo(...)
  if (ts.isExpressionStatement(stmt)) {
    const e = stmt.expression;
    if (ts.isCallExpression(e)) {
      const callee = e.expression;
      let name: string | null = null;
      if (ts.isIdentifier(callee)) name = callee.text;
      else if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && ts.isIdentifier(callee.name)) {
        if (callee.expression.text === 'console') name = `console.${callee.name.text}`;
      }
      if (name && /^(console\.(error|warn|log|info)|logError|logWarn|logInfo|logDebug)$/.test(name)) {
        // Try to extract log prefix
        if (e.arguments.length > 0) {
          const first = e.arguments[0];
          const v = getStringLiteralValue(first);
          if (v) {
            // Strip trailing colon/space
            const cleaned = v.replace(/:\s*$/, '');
            return { logPrefix: cleaned };
          }
        }
        return {};
      }
    }
  }
  // if (process.env.NODE_ENV === 'development') console.error(...)
  if (ts.isIfStatement(stmt) && !stmt.elseStatement) {
    const cond = stmt.expression;
    const condText = src.slice(cond.pos, cond.end).trim();
    if (/process\.env\.NODE_ENV\s*===\s*['"]development['"]/.test(condText)) {
      // Then must be allowed log statement (single)
      const then = stmt.thenStatement;
      if (ts.isBlock(then)) {
        if (then.statements.length === 1) return isAllowedLogStatement(then.statements[0], src);
        return null;
      }
      return isAllowedLogStatement(then, src);
    }
  }
  // Comment-only or empty? statements can't be empty here, but a single-line `// console.error(...)` won't appear as a statement.
  return null;
}

function defaultLogPrefix(method: string, route: string, errMsg: string): string {
  // Best-effort fallback
  return `❌ ${errMsg.replace(/^Failed to /, 'Error ')}`;
}

function isAsyncHandlerCall(node: ts.Node): boolean {
  return ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'asyncHandler';
}

function processFile(file: string): { edits: Edit[]; source: string; sourceFile: ts.SourceFile; needsImport: boolean } {
  const fullPath = path.resolve(file);
  const source = fs.readFileSync(fullPath, 'utf8');
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  const edits: Edit[] = [];
  const hasImport = /from ['"]\.\.\/utils\/async-handler['"]/.test(source);

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && isAppRoute(node)) {
      const args = node.arguments;
      if (args.length >= 2) {
        const handler = args[args.length - 1];
        // Skip if already wrapped
        if (isAsyncHandlerCall(handler)) {
          ts.forEachChild(node, visit);
          return;
        }
        // Handler must be ArrowFunction or FunctionExpression
        let isAsync = false;
        let body: ts.Block | null = null;
        if (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) {
          isAsync = handler.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
          if (isAsync && handler.body && ts.isBlock(handler.body)) {
            body = handler.body;
          }
        }
        if (body && body.statements.length === 1 && ts.isTryStatement(body.statements[0])) {
          const tryStmt = body.statements[0] as ts.TryStatement;
          if (!tryStmt.finallyBlock && tryStmt.catchClause) {
            const catchClause = tryStmt.catchClause;
            const catchBody = catchClause.block;
            // Catch body: optional log statements + 1 terminal "send 500"
            const stmts = catchBody.statements;
            if (stmts.length >= 1) {
              const terminal = stmts[stmts.length - 1];
              const term = analyzeCatchTerminal(terminal);
              if (term) {
                let logPrefix: string | undefined;
                let allOk = true;
                for (let i = 0; i < stmts.length - 1; i++) {
                  const r = isAllowedLogStatement(stmts[i], source);
                  if (!r) { allOk = false; break; }
                  if (!logPrefix && r.logPrefix) logPrefix = r.logPrefix;
                }
                if (allOk) {
                  // Build replacement for the handler
                  const tryBlockText = source.slice(tryStmt.tryBlock.pos, tryStmt.tryBlock.end);
                  // Get handler signature text up to body
                  const handlerStart = handler.pos;
                  const handlerEnd = handler.end;
                  // We need: signature (everything before body), then asyncHandler-wrapped arrow with try body inlined.
                  // Simpler: keep the same handler signature + body but replace body with try-block contents.
                  // Then wrap: asyncHandler(<modified handler>, { errorMessage, errorLogPrefix })
                  const bodyStart = body.getStart(sourceFile);
                  const bodyEnd = body.getEnd();
                  const sigText = source.slice(handler.getStart(sourceFile), bodyStart);
                  // tryBlock is itself a block with braces — its contents are between tryBlock.getStart()+1 and tryBlock.getEnd()-1
                  const tb = tryStmt.tryBlock;
                  const innerStart = tb.getStart(sourceFile) + 1; // skip '{'
                  const innerEnd = tb.getEnd() - 1; // skip '}'
                  const innerText = source.slice(innerStart, innerEnd);
                  const newBody = `{${innerText}}`;
                  const errMsg = term.errorMessage.replace(/'/g, "\\'");
                  let finalPrefix = logPrefix ?? defaultLogPrefix('', '', term.errorMessage);
                  if (!finalPrefix.startsWith('❌')) finalPrefix = `❌ ${finalPrefix}`;
                  const prefixEsc = finalPrefix.replace(/'/g, "\\'");
                  let extraOpt = '';
                  if (term.extraFields.length > 0) {
                    const parts = term.extraFields.map(f => `${f.key === '_error' ? "'_error'" : f.key}: '${f.value.replace(/'/g, "\\'")}'`);
                    extraOpt = `, extraErrorFields: { ${parts.join(', ')} }`;
                  }
                  const replacement = `asyncHandler(${sigText}${newBody}, { errorMessage: '${errMsg}', errorLogPrefix: '${prefixEsc}'${extraOpt} })`;
                  edits.push({
                    start: handler.getStart(sourceFile),
                    end: handler.getEnd(),
                    replacement,
                    why: `${path.basename(file)} route catch -> asyncHandler (msg="${term.errorMessage}")`,
                  });
                }
              }
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  return { edits, source, sourceFile, needsImport: edits.length > 0 && !hasImport };
}

function applyEdits(source: string, edits: Edit[], needsImport: boolean): string {
  // Apply in reverse
  edits.sort((a, b) => b.start - a.start);
  let out = source;
  for (const e of edits) {
    out = out.slice(0, e.start) + e.replacement + out.slice(e.end);
  }
  if (needsImport) {
    // Insert import after last existing import
    const importRegex = /^import .*?;\s*$/gm;
    let lastIdx = -1;
    let m: RegExpExecArray | null;
    while ((m = importRegex.exec(out)) !== null) lastIdx = m.index + m[0].length;
    const importLine = `\nimport { asyncHandler } from '../utils/async-handler';`;
    if (lastIdx >= 0) out = out.slice(0, lastIdx) + importLine + out.slice(lastIdx);
    else out = importLine.trimStart() + '\n' + out;
  }
  return out;
}

const dryRun = process.argv.includes('--dry-run');
let totalEdits = 0;
for (const f of FILES) {
  if (!fs.existsSync(f)) { console.log(`SKIP ${f} (missing)`); continue; }
  const { edits, source, needsImport } = processFile(f);
  if (edits.length === 0) {
    console.log(`${f}: 0 candidates`);
    continue;
  }
  console.log(`${f}: ${edits.length} candidates`);
  for (const e of edits) console.log(`  - ${e.why}`);
  if (!dryRun) {
    const out = applyEdits(source, edits, needsImport);
    fs.writeFileSync(f, out);
  }
  totalEdits += edits.length;
}
console.log(`\nTotal candidates: ${totalEdits}${dryRun ? ' (dry run)' : ''}`);
