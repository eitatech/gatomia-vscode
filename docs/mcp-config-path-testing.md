# MCP Config Path Testing Guide

Este documento fornece instruções para testar a funcionalidade de detecção automática do caminho do arquivo `mcp.json` em diferentes IDEs baseadas no VS Code.

## Problema Resolvido

Anteriormente, o comando "Open MCP Config" sempre abria o arquivo `mcp.json` do diretório padrão do VS Code (`Code/User/mcp.json`), mesmo quando rodando em VS Code Insiders, Cursor, Windsurf ou outras IDEs baseadas no VS Code.

## Solução Implementada

A extensão agora detecta automaticamente qual IDE está sendo usada através do `vscode.env.appName` e ajusta o caminho do arquivo `mcp.json` de acordo:

- **VS Code**: `~/Library/Application Support/Code/User/mcp.json`
- **VS Code Insiders**: `~/Library/Application Support/Code - Insiders/User/mcp.json`
- **Cursor**: `~/Library/Application Support/Cursor/User/mcp.json`
- **Windsurf**: `~/Library/Application Support/windsurf/User/mcp.json`
- **Positron**: `~/Library/Application Support/Positron/User/mcp.json`
- **VSCodium**: `~/Library/Application Support/VSCodium/User/mcp.json`

### Plataformas Suportadas

#### macOS
- Diretório base: `~/Library/Application Support/{IDE}/User/`

#### Linux
- Diretório base: `~/.config/{IDE}/User/`

#### Windows
- Diretório base: `%APPDATA%\{IDE}\User\`

#### WSL (Windows Subsystem for Linux)
- Diretório base: Traduz o path do Windows para WSL automaticamente

## Como Testar

### 1. Verificar o Path Atual

Execute o seguinte comando no terminal integrado da IDE:

**macOS/Linux:**
```bash
# Para VS Code
ls -la ~/Library/Application\ Support/Code/User/mcp.json

# Para VS Code Insiders
ls -la ~/Library/Application\ Support/Code\ -\ Insiders/User/mcp.json

# Para Cursor
ls -la ~/Library/Application\ Support/Cursor/User/mcp.json
```

**Windows:**
```powershell
# Para VS Code
dir "%APPDATA%\Code\User\mcp.json"

# Para VS Code Insiders
dir "%APPDATA%\Code - Insiders\User\mcp.json"

# Para Cursor
dir "%APPDATA%\Cursor\User\mcp.json"
```

### 2. Testar o Comando "Open MCP Config"

1. Abra a Paleta de Comandos (`Cmd+Shift+P` ou `Ctrl+Shift+P`)
2. Digite "Open MCP Config"
3. Execute o comando
4. Verifique se o arquivo aberto é o correto para sua IDE

### 3. Verificar o Path no Console

Você pode verificar qual path está sendo usado adicionando um log temporário:

1. Abra o Console de Desenvolvedor (`Help` > `Toggle Developer Tools`)
2. Execute o comando "Open MCP Config"
3. Procure por logs mostrando o path do arquivo `mcp.json`

### 4. Testar em Diferentes IDEs

Se você tem múltiplas IDEs instaladas, teste em cada uma:

- [ ] VS Code
- [ ] VS Code Insiders
- [ ] Cursor
- [ ] Windsurf
- [ ] Outros forks

### 5. Validar a Detecção Automática

Execute este código no terminal integrado para ver qual IDE está sendo detectada:

```javascript
// Copie e cole no Console de Desenvolvedor (Help > Toggle Developer Tools)
console.log('IDE Name:', vscode.env.appName);
```

## Casos de Teste

### Caso 1: VS Code Standard
- **IDE**: Visual Studio Code
- **Path Esperado (macOS)**: `~/Library/Application Support/Code/User/mcp.json`
- **Resultado**: ✅ Deve abrir o arquivo correto

### Caso 2: VS Code Insiders
- **IDE**: Visual Studio Code - Insiders
- **Path Esperado (macOS)**: `~/Library/Application Support/Code - Insiders/User/mcp.json`
- **Resultado**: ✅ Deve abrir o arquivo correto

### Caso 3: Cursor
- **IDE**: Cursor
- **Path Esperado (macOS)**: `~/Library/Application Support/Cursor/User/mcp.json`
- **Resultado**: ✅ Deve abrir o arquivo correto

### Caso 4: IDE Desconhecida
- **IDE**: Fork não mapeado
- **Path Esperado (macOS)**: `~/Library/Application Support/Code/User/mcp.json` (fallback)
- **Resultado**: ✅ Deve usar o path padrão do VS Code como fallback

## Troubleshooting

### Arquivo não encontrado

Se o comando retornar "arquivo não encontrado", isso é esperado se você ainda não configurou nenhum servidor MCP. O importante é verificar se o **path está correto** para sua IDE.

### Path incorreto

Se o path ainda estiver errado:

1. Verifique qual IDE você está usando: `vscode.env.appName`
2. Verifique se a IDE está na lista de mapeamentos em `src/utils/platform-utils.ts`
3. Se for um fork não mapeado, o sistema usará o path padrão do VS Code como fallback

### Múltiplas instalações

Se você tem múltiplas versões da mesma IDE instaladas:
- A extensão sempre usará o path da IDE que está rodando atualmente
- Cada IDE mantém seu próprio arquivo `mcp.json` independente

## Implementação Técnica

A detecção é feita em `src/utils/platform-utils.ts` através da função `getIDEDirectoryName()` que:

1. Lê o `vscode.env.appName`
2. Identifica a IDE através de pattern matching no nome
3. Retorna o nome do diretório correto para cada plataforma
4. Faz fallback para "Code" se a IDE não for reconhecida

## Contribuindo

Se você usa um fork do VS Code não listado, contribua adicionando o mapeamento em `getIDEDirectoryName()`:

```typescript
// Adicione antes do return padrão
if (appName.toLowerCase().includes("nome-da-ide")) {
    return "Nome-Do-Diretorio";
}
```

## Status dos Testes

- ✅ 14 testes unitários cobrindo todas as plataformas e IDEs
- ✅ Testes para macOS, Linux, Windows
- ✅ Testes para VS Code, Insiders, Cursor, Windsurf, Positron, VSCodium
- ✅ Teste de fallback para IDEs desconhecidas
- ✅ 1566 testes da suite completa passando

## Versão

Esta funcionalidade está disponível a partir da versão **v0.33.0**.
