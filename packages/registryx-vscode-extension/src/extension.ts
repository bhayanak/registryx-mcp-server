import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const serverPath = vscode.Uri.joinPath(
    context.extensionUri,
    'dist',
    'server',
    'index.js'
  ).fsPath;

  const emitter = new vscode.EventEmitter<void>();
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('registryx')) emitter.fire();
    })
  );

  const disposable = vscode.lm.registerMcpServerDefinitionProvider('registryx', {
    onDidChangeMcpServerDefinitions: emitter.event,
    provideMcpServerDefinitions(_token: vscode.CancellationToken) {
      const config = vscode.workspace.getConfiguration('registryx');

      return [
        new vscode.McpStdioServerDefinition(
          'RegistryX',
          process.execPath,
          [serverPath],
          {
            REGISTRYX_MCP_REGISTRIES: config.get<string>('registries') ?? 'npm,pypi,maven,crates',
            REGISTRYX_MCP_NPM_TOKEN: config.get<string>('npmToken') ?? '',
            REGISTRYX_MCP_TIMEOUT_MS: String(config.get<number>('timeoutMs') ?? 15000),
            REGISTRYX_MCP_CACHE_TTL_MS: String(config.get<number>('cacheTtlMs') ?? 300000),
          },
          '0.1.0'
        ),
      ];
    },
  });
  context.subscriptions.push(disposable);
}

export function deactivate() {}
