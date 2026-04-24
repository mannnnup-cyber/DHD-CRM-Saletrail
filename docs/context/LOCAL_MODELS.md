# Local Models (Claude Code + Ollama)

This document explains how to run the Claude Code CLI against a local model host (for example, Ollama) so you can use local models in place of Anthropic's cloud backend.

Warning: Running models locally consumes CPU / GPU and storage on your machine. Ollama and local models may require elevated permissions or specific OS dependencies.

Steps

1. Install Claude Code CLI

Open a PowerShell terminal and run:

```powershell
npm install -g @anthropic-ai/claude-code
```

2. Install Ollama

Download and install Ollama from https://ollama.ai (choose the correct installer for your OS). Follow Ollama's install instructions and start the service. By default Ollama listens on `http://localhost:11434`.

3. Configure VS Code to use a local backend

- Open VS Code settings (Ctrl + ,)
- Search for `claude-code.environmentVariables` and select Edit in settings.json
- Add an entry similar to the following (or update your workspace `.vscode/settings.json`):

```json
{
  "claude-code.environmentVariables": {
    "ANTHROPIC_BASE_URL": "http://localhost:11434/v1",
    "ANTHROPIC_API_KEY": ""
  }
}
```

4. Launch Claude Code CLI

Open the integrated terminal in VS Code and run:

```powershell
claude
```

When prompted, skip the official Anthropic login flow — the CLI will use the `ANTHROPIC_BASE_URL` you configured to connect to your local model server.

5. Notes and troubleshooting

- If Ollama uses a different port or path, update `ANTHROPIC_BASE_URL` accordingly.
- If your local server requires an API key or token, place that in `ANTHROPIC_API_KEY`.
- To run higher-performance models you may need a GPU and driver support.
- This setup avoids Anthropic token-based pricing; monitor local resource usage.

6. Security

- Running models locally removes cloud rate limits but also removes centrally managed security. Do not expose this endpoint publicly.
