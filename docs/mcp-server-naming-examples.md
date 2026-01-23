# MCP Server Naming Examples

Este documento demonstra como os servidores MCP do seu `mcp.json` serão exibidos na interface do GatomIA.

## Formato de Exibição

Os tools são agrupados por servidor MCP, com o servidor exibido como cabeçalho e cada tool como item da lista.

```
📦 [Nome do Servidor MCP]
  ☐ Tool Action 1
  ☐ Tool Action 2
  ☐ Tool Action 3
```

## Mapeamento dos Seus Servidores

Baseado no seu arquivo de configuração `mcp.json`, aqui está como cada servidor será exibido:

### 1. Sequential Thinking
**ID no mcp.json**: `sequentialthinking`  
**Exibido como**: Sequential Thinking

**Tools disponíveis**:
- Think

---

### 2. Memory
**ID no mcp.json**: `memory`  
**Exibido como**: Memory

**Tools disponíveis**:
- Add Observations
- Create Entities
- Create Relations
- Delete Entities
- Delete Observations
- Delete Relations
- Open Nodes
- Read Graph
- Search Nodes

---

### 3. Alchemy
**ID no mcp.json**: `alchemy`  
**Exibido como**: Alchemy

**Tools disponíveis**:
- Get Block
- Get Block Receipts
- Get Transaction
- Get Transaction Receipt
- (outros métodos Alchemy)

---

### 4. Playwright MCP
**ID no mcp.json**: `microsoft/playwright-mcp`  
**Exibido como**: Playwright MCP

**Tools disponíveis**:
- Navigate
- Screenshot
- Click
- Fill
- Select
- Hover
- Evaluate
- (outros métodos Playwright)

---

### 5. Flipside
**ID no mcp.json**: `flipside`  
**Exibido como**: Flipside

**Tools disponíveis**:
- (métodos Flipside)

---

### 6. GitHub MCP Server
**ID no mcp.json**: `io.github.github/github-mcp-server`  
**Exibido como**: GitHub MCP Server

**Tools disponíveis**:
- Create Or Update File
- Push Files
- Search Repositories
- Search Code
- Search Issues
- Create Issue
- Update Issue
- Create Pull Request
- Get File Contents
- Get Pull Request
- List Commits
- Create Branch
- Fork Repository
- (outros métodos GitHub)

---

### 7. Context7
**ID no mcp.json**: `io.github.upstash/context7`  
**Exibido como**: Context7

**Tools disponíveis**:
- Get Library Docs
- Resolve Library Id

---

### 8. Serena
**ID no mcp.json**: `oraios/serena`  
**Exibido como**: Serena

**Tools disponíveis**:
- Activate Project
- Get Current Config
- Get Symbols Overview
- Open Nodes
- Write Memory
- List Dir
- Read Memory
- Find Symbol
- Get Symbol Body
- Find Referencing Symbols
- Search For Pattern
- Insert After Symbol
- Insert Before Symbol
- Replace Symbol Body
- Rename Symbol
- Find File
- Read File
- Replace In File
- Think About Collected Information

---

### 9. Firecrawl MCP Server
**ID no mcp.json**: `firecrawl/firecrawl-mcp-server`  
**Exibido como**: Firecrawl MCP Server

**Tools disponíveis**:
- Scrape
- Crawl
- Map
- (outros métodos Firecrawl)

---

### 10. Etherscan
**ID no mcp.json**: `etherscan`  
**Exibido como**: Etherscan

**Tools disponíveis**:
- (métodos Etherscan)

---

## Exemplo Visual na Interface

Quando você abrir o MCP Tools Selector, verá algo assim:

```
╔═══════════════════════════════════════════════════════╗
║ Select MCP Tools                                      ║
╠═══════════════════════════════════════════════════════╣
║                                                       ║
║ 📦 Sequential Thinking                                ║
║   ☐ Think                                             ║
║                                                       ║
║ 📦 Memory                                             ║
║   ☐ Add Observations                                  ║
║   ☐ Create Entities                                   ║
║   ☐ Create Relations                                  ║
║   ☐ Read Graph                                        ║
║                                                       ║
║ 📦 Serena                                             ║
║   ☐ Activate Project                                  ║
║   ☐ Get Symbols Overview                              ║
║   ☐ List Dir                                          ║
║   ☐ Read File                                         ║
║   ☐ Search For Pattern                                ║
║   ☐ Think About Collected Information                 ║
║                                                       ║
║ 📦 GitHub MCP Server                                  ║
║   ☐ Create Or Update File                             ║
║   ☐ Create Pull Request                               ║
║   ☐ Search Repositories                               ║
║                                                       ║
║ 📦 Context7                                           ║
║   ☐ Get Library Docs                                  ║
║   ☐ Resolve Library Id                                ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
```

## Detalhes Técnicos

### Lógica de Extração de Nome

1. **Server ID Extraction** (`extractServerIdFromToolName`):
   - Remove o prefixo `mcp_`
   - Extrai tudo até o primeiro underscore para servidores simples
   - Preserva paths (com `/`) e reverse domain notation (com `.`)

2. **Tool Name Formatting** (`formatDisplayName`):
   - Remove o prefixo `mcp_` e o server ID
   - Converte underscores para espaços
   - Aplica Title Case em cada palavra

3. **Server Name Formatting** (`formatServerName`):
   - Usa um dicionário `knownServers` para servidores conhecidos
   - Para servidores desconhecidos, aplica formatação inteligente:
     - Remove organização/namespace
     - Remove sufixos como `-mcp`, `-server`
     - Converte para Title Case

### Exemplos de Transformação

| Tool Name (formato interno) | Server ID | Server Display | Tool Display |
|------------------------------|-----------|----------------|--------------|
| `mcp_memory_add_observations` | `memory` | Memory | Add Observations |
| `mcp_oraios/serena_list` | `oraios/serena` | Serena | List |
| `mcp_io.github.github/github-mcp-server_create_pull_request` | `io.github.github/github-mcp-server` | GitHub MCP Server | Create Pull Request |
| `mcp_io.github.upstash/context7_get_library_docs` | `io.github.upstash/context7` | Context7 | Get Library Docs |

## Como Verificar

Para testar se os nomes estão sendo exibidos corretamente:

1. Recarregue a extensão no VS Code (`Ctrl+Shift+P` → "Developer: Reload Window")
2. Abra a view de Hooks
3. Clique em "Add Hook" ou edite um hook existente
4. No campo de ação, selecione "Run MCP Agent"
5. Você deverá ver os servidores agrupados com os nomes limpos mostrados acima

## Testes

Todos os exemplos acima são validados por 33 testes unitários em:
`ui/tests/unit/lib/mcp-utils.spec.tsx`

Execute com:
```bash
npm test -- ui/tests/unit/lib/mcp-utils.spec.tsx
```
