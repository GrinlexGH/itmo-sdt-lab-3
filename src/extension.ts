import * as vscode from 'vscode';

const LANGS = ['c', 'cpp'];

function limits() {
  const cfg = vscode.workspace.getConfiguration('cComplexity');
  return {
    threshold: cfg.get<number>('threshold', 10),
    maxLines: cfg.get<number>('maxLines', 50),
    codeLens: cfg.get<boolean>('codeLens', true),
    diagnostics: cfg.get<boolean>('diagnostics', true)
  };
}

interface FuncMetric {
  name: string;
  nameRange: vscode.Range;
  complexity: number;
  lines: number;
}

function analyze(doc: vscode.TextDocument): FuncMetric[] {
  const range = new vscode.Range(0, 0, 0, 5);
  return [{ name: "stub", nameRange: range, complexity: 99, lines: 1 }];
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

    const metrics = analyze(doc);
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

function updateDiagnostics(
  doc: vscode.TextDocument,
  collection: vscode.DiagnosticCollection
): void {
  const { threshold, maxLines, diagnostics } = limits();
  if (!diagnostics) {
    collection.delete(doc.uri);
    return;
  }

  const metrics = analyze(doc);
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

  vscode.workspace.textDocuments.forEach(update);
}

export function deactivate() { }
