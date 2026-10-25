import * as vscode from 'vscode';
import { hasBody } from './complexity';

const LANGS = ['c', 'cpp'];
const FUNC_KINDS = new Set<vscode.SymbolKind>([
  vscode.SymbolKind.Function,
  vscode.SymbolKind.Method,
  vscode.SymbolKind.Constructor
]);

function limits() {
  const cfg = vscode.workspace.getConfiguration('cComplexity');
  return {
    threshold: cfg.get<number>('threshold', 10),
    maxLines: cfg.get<number>('maxLines', 50),
    codeLens: cfg.get<boolean>('codeLens', true),
    diagnostics: cfg.get<boolean>('diagnostics', true)
  };
}

interface Sym {
  name: string;
  range: vscode.Range;
  nameRange: vscode.Range;
}

interface FuncMetric {
  name: string;
  nameRange: vscode.Range;
  complexity: number;
  lines: number;
}

type RawSymbol = vscode.DocumentSymbol | vscode.SymbolInformation;

function getSymbolsInfo(symbols: RawSymbol[], out: Sym[]): void {
  for (const s of symbols) {
    if (FUNC_KINDS.has(s.kind)) {
      const range = 'range' in s ? s.range : s.location.range;
      const nameRange = 'selectionRange' in s ? s.selectionRange : range;
      out.push({ name: s.name, range, nameRange });
    }
    if ('children' in s) {
      getSymbolsInfo(s.children, out);
    }
  }
}

async function analyze(doc: vscode.TextDocument): Promise<FuncMetric[]> {
  const raw = await vscode.commands.executeCommand<RawSymbol[]>(
    'vscode.executeDocumentSymbolProvider',
    doc.uri
  );

  const syms: Sym[] = [];
  getSymbolsInfo(raw ?? [], syms);

  const result: FuncMetric[] = [];
  for (const s of syms) {
    const text = doc.getText(s.range);
    if (!hasBody(text)) {
      continue;
    }
    result.push({
      name: s.name,
      nameRange: s.nameRange,
      complexity: 99,
      lines: s.range.end.line - s.range.start.line + 1
    });
  }

  return result;
}

class MetricsCodeLensProvider implements vscode.CodeLensProvider {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.emitter.event;

  refresh(): void {
    this.emitter.fire();
  }

  async provideCodeLenses(doc: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    const { threshold, maxLines, codeLens } = limits();
    if (!codeLens) {
      return [];
    }

    const metrics = await analyze(doc);
    return metrics.map(m => {
      const bad = m.complexity > threshold || m.lines > maxLines;
      const title =
        (bad ? '$(warning) ' : '') +
        `Complexity: ${m.complexity}` +
        (m.complexity > threshold ? ` (limit ${threshold})` : '') +
        ` · ${m.lines} lines` +
        (m.lines > maxLines ? ` (limit ${maxLines})` : '');
      return new vscode.CodeLens(
        new vscode.Range(m.nameRange.start, m.nameRange.start),
        { title, command: 'cComplexity.showReport' }
      );
    });
  }
}

async function updateDiagnostics(
  doc: vscode.TextDocument,
  collection: vscode.DiagnosticCollection
): Promise<void> {
  const { threshold, maxLines, diagnostics } = limits();
  if (!diagnostics) {
    collection.delete(doc.uri);
    return;
  }

  // File can change between await return
  const version = doc.version;
  const metrics = await analyze(doc);
  if (doc.version !== version) { return; }

  const warnings: vscode.Diagnostic[] = [];

  for (const m of metrics) {
    if (m.complexity > threshold) {
      warnings.push(new vscode.Diagnostic(
        m.nameRange,
        `Function "${m.name}" has cyclomatic complexity ${m.complexity} (limit ${threshold}).`,
        vscode.DiagnosticSeverity.Warning
      ));
    }

    if (m.lines > maxLines) {
      warnings.push(new vscode.Diagnostic(
        m.nameRange,
        `Function "${m.name}" is ${m.lines} lines long (limit ${maxLines}).`,
        vscode.DiagnosticSeverity.Warning
      ));
    }
  }

  collection.set(doc.uri, warnings);
}

export function activate(context: vscode.ExtensionContext) {
  const lensProvider = new MetricsCodeLensProvider();
  const diagnostics = vscode.languages.createDiagnosticCollection('c-complexity');
  const selector = LANGS.map(language => ({ language }));

  const update = (doc: vscode.TextDocument) => {
    if (!LANGS.includes(doc.languageId)) { return; }
    updateDiagnostics(doc, diagnostics);
    lensProvider.refresh();
  };

  context.subscriptions.push(
    diagnostics,
    vscode.languages.registerCodeLensProvider(selector, lensProvider),

    vscode.workspace.onDidOpenTextDocument(update),
    vscode.workspace.onDidSaveTextDocument(update),
    vscode.workspace.onDidCloseTextDocument(d => diagnostics.delete(d.uri)),
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('cComplexity')) {
        vscode.workspace.textDocuments.forEach(update);
      }
    })
  );

  setTimeout(() => vscode.workspace.textDocuments.forEach(d => update(d)), 2000);
}

export function deactivate() { }
