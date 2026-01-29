# Solução: Versionamento e Autoria de Documentos

## Problema

Os documentos de especificação (spec.md, plan.md, tasks.md) possuem campos VERSION e OWNER, mas nenhum deles estava sendo preenchido corretamente. Era necessário:

1. Implementar versionamento no formato {major}.{minor} (1.0 → 1.9 → 2.0)
2. Capturar o autor do Git automaticamente
3. Manter controle interno da extensão para gerenciar essas informações

## Solução Implementada

### 1. Serviços Criados

#### `src/utils/git-user-info.ts`
Utilitários para obter informações do Git:

- `getGitUserInfo()`: Executa comandos git config para obter nome e email
- `formatGitUser()`: Formata como "Nome <email>"
- Fallback para "Unknown" se Git não estiver configurado

#### `src/services/document-version-service.ts`
Gerenciador de versionamento de documentos:

- `getCurrentVersion()`: Lê versão do frontmatter
- `getNextVersion()`: Calcula próxima versão
- `incrementVersion()`: Aplica regras de incremento (0-9 minor, depois major++)
- `updateFrontmatter()`: Atualiza YAML frontmatter preservando outros campos
- Cache em memória para performance

#### `src/services/document-template-processor.ts`
Processador de templates:

- `processNewDocument()`: Processa documentos recém-criados
  - Substitui placeholder [AUTHOR] por autor real
  - Define versão inicial como 1.0
- `processDocumentUpdate()`: Atualiza versão de documentos existentes
- `getDocumentMetadata()`: Consulta versão e autor

#### `src/features/documents/document-versioning-commands.ts`
Comandos VS Code para controle manual:

- `gatomia.processNewDocument`: Processa novo documento
- `gatomia.updateDocumentVersion`: Incrementa versão
- `gatomia.showDocumentMetadata`: Exibe versão e autor

### 2. Integração na Extensão

#### Processamento Automático
Adicionado FileSystemWatcher em `src/extension.ts`:

- Monitora criação de arquivos em `specs/**/spec.md`, `specs/**/plan.md`, `specs/**/tasks.md`
- Automaticamente processa novos documentos ao serem criados
- Substitui [AUTHOR] e define versão 1.0

#### Leitura de Owner
Atualizado `syncSpecReviewFlowSummary()` em `src/extension.ts`:

- Removido hardcode "unknown"
- Lê owner do frontmatter do spec.md
- Fallback para "unknown" se arquivo não existir

### 3. Templates Atualizados

Todos os templates agora incluem frontmatter com versão e owner:

#### `.specify/templates/spec-template.md`
```yaml
---
version: "1.0"
owner: "[AUTHOR]"
---
```

#### `.specify/templates/plan-template.md`
```yaml
---
version: "1.0"
owner: "[AUTHOR]"
---
```

#### `.specify/templates/tasks-template.md`
```yaml
---
description: "Task list template for feature implementation"
version: "1.0"
owner: "[AUTHOR]"
---
```

### 4. Fluxo de Trabalho

#### Criação de Nova Spec

1. Usuário executa `/speckit.specify` ou script bash cria arquivo
2. Arquivo é criado a partir do template com placeholder [AUTHOR]
3. FileSystemWatcher detecta criação
4. `DocumentTemplateProcessor.processNewDocument()` é chamado
5. Placeholder [AUTHOR] é substituído por info do Git
6. Frontmatter atualizado com version: "1.0" e owner real

#### Atualização de Documento

1. Usuário faz alterações significativas
2. Executa comando `GatomIA: Update Document Version`
3. Versão atual é lida do frontmatter
4. Nova versão calculada (ex: 1.5 → 1.6, ou 1.9 → 2.0)
5. Frontmatter atualizado preservando outros campos

#### Exibição de Informações

- Review Flow agora exibe owner real ao invés de "unknown"
- Comando `Show Document Metadata` disponível para consultar

### 5. Regras de Versionamento

```
1.0 → 1.1 → 1.2 → ... → 1.9 → 2.0 → 2.1 → ... → 2.9 → 3.0
```

- **Minor**: Incrementa de 0 a 9
- **Major**: Incrementa quando minor atinge 10 (9 + 1)
- Versão inicial sempre 1.0

## Arquivos Modificados

### Novos Arquivos
- `src/utils/git-user-info.ts`
- `src/services/document-version-service.ts`
- `src/services/document-template-processor.ts`
- `src/features/documents/document-versioning-commands.ts`
- `docs/document-versioning.md`

### Arquivos Modificados
- `src/extension.ts`:
  - Adicionado import de `matter` e `registerDocumentVersioningCommands`
  - Atualizado `syncSpecReviewFlowSummary()` para ler owner do frontmatter
  - Adicionado FileSystemWatcher para processar novos documentos
  - Registrado comandos de versionamento
- `.specify/templates/spec-template.md`: Adicionado frontmatter
- `.specify/templates/plan-template.md`: Adicionado frontmatter
- `.specify/templates/tasks-template.md`: Adicionado frontmatter

## Testes e Validação

✅ Compilação TypeScript bem-sucedida (`npm run build:ext`)  
✅ Lint e formatação aprovados (`npm run check`)  
✅ Nenhum erro de tipo  
✅ Imports corrigidos  
✅ Código formatado segundo padrões do projeto

## Uso

### Automático
Ao criar specs via `/speckit.specify`, os documentos são processados automaticamente.

### Manual
```
Ctrl+Shift+P → "GatomIA: Process New Document"      # Processar novo doc
Ctrl+Shift+P → "GatomIA: Update Document Version"   # Incrementar versão
Ctrl+Shift+P → "GatomIA: Show Document Metadata"    # Ver versão/owner
```

## Melhorias Futuras

- [ ] Indicadores visuais de versão nas tree views
- [ ] Histórico de versões
- [ ] Auto-incremento ao salvar alterações significativas
- [ ] Integração com commits Git
- [ ] Resolução de conflitos em edições concorrentes
- [ ] Dashboard de documentação com visão geral de versões
