# Correção do Sistema de Triggers de Hooks

## Problema Identificado

Os hooks configurados para acionar após a conclusão de comandos SpecKit não estavam funcionando corretamente. O problema raiz era:

**Os triggers eram disparados IMEDIATAMENTE após enviar o comando para o Copilot Chat, não APÓS a conclusão real do comando.**

### Comportamento Anterior (Incorreto)

```typescript
async executeSpecKitCommand(operation: string): Promise<void> {
    // 1. Envia comando para Copilot Chat
    await sendPromptToChat(`/speckit.${operation}`);

    // 2. Dispara trigger IMEDIATAMENTE (INCORRETO!)
    this.triggerRegistry.fireTrigger("speckit", operation);
}
```

**Problema:** O trigger era disparado antes do Copilot completar a execução, então os hooks tentavam executar ações em arquivos que ainda não existiam ou não estavam completos.

## Solução Implementada

### Abordagem Híbrida: FileSystemWatcher + Validação de Parser

Criamos o `CommandCompletionDetector` que:

1. **Monitora mudanças no sistema de arquivos** usando `FileSystemWatcher`
2. **Valida que os arquivos foram processados com sucesso** antes de disparar triggers
3. **Usa debounce** para evitar triggers duplicados
4. **Integra com o parser de tarefas** para garantir que arquivos de tasks são válidos

### Arquitetura

```
┌─────────────────┐
│  User executes  │
│ /speckit.tasks  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│     SpecManager         │
│ executeSpecKitCommand() │  ← Apenas envia comando
└────────┬────────────────┘
         │
         ▼
┌──────────────────────┐
│   Copilot Chat       │  ← Processa comando
│  Cria/atualiza files │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────────────┐
│ CommandCompletionDetector    │
│  - FileSystemWatcher detecta │  ← Detecta mudanças
│  - Valida parsing            │  ← Valida conteúdo
│  - Debounce (2s)             │  ← Evita duplicatas
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────┐
│   TriggerRegistry    │  ← Dispara trigger
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│    HookExecutor      │  ← Executa hooks
└──────────────────────┘
```

## Implementação Técnica

### 1. CommandCompletionDetector

Localização: `src/features/hooks/services/command-completion-detector.ts`

#### Padrões de Arquivo Monitorados

```typescript
const OPERATION_FILE_PATTERNS: Record<string, string[]> = {
    specify: ["**/specs/*/spec.md"],
    tasks: ["**/specs/*/tasks.md"],
    plan: ["**/specs/*/plan.md"],
    taskstoissues: ["**/specs/*/tasks.md", "**/specs/*/.github-issues.json"],
    // ... outros padrões
};
```

#### Validação de Arquivos

Para operações de `tasks` e `taskstoissues`, o detector:

1. Verifica se o arquivo existe e não está vazio
2. **Tenta fazer parse das tarefas** usando `parseTasksFromFile()`
3. Valida que há tarefas válidas (length > 0)
4. Só então dispara o trigger

```typescript
private async validateFileProcessing(uri: Uri, operation: OperationType): Promise<boolean> {
    // Verifica se arquivo existe
    const stat = await workspace.fs.stat(uri);
    if (stat.size === 0) return false;

    // Para tasks, valida parsing
    if (operation === "tasks" || operation === "taskstoissues") {
        const tasks = await parseTasksFromFile(uri.fsPath);
        if (!tasks || tasks.length === 0) return false;
    }

    return true;
}
```

### 2. Debounce para Evitar Duplicatas

```typescript
const DEBOUNCE_DELAY_MS = 2000; // 2 segundos

// Ignora triggers muito próximos
if (now - lastTrigger < DEBOUNCE_DELAY_MS) {
    return; // Ignora
}
```

### 3. Integração no Extension.ts

```typescript
// Initialize CommandCompletionDetector
commandCompletionDetector = new CommandCompletionDetector(
    triggerRegistry,
    outputChannel
);
commandCompletionDetector.initialize();
```

## Mudanças no SpecManager

O `executeSpecKitCommand()` agora apenas envia o comando, não dispara triggers:

```typescript
async executeSpecKitCommand(operation: string): Promise<void> {
    // Apenas envia comando
    await sendPromptToChat(`/speckit.${operation}`);

    // Triggers agora são disparados pelo CommandCompletionDetector
    // quando detecta que o arquivo foi criado E validado
}
```

## Testes

### CommandCompletionDetector Tests

Localização: `tests/unit/features/hooks/services/command-completion-detector.test.ts`

- ✅ Inicialização correta
- ✅ Triggers manuais funcionam
- ✅ Suporta todas as operações SpecKit
- ✅ Clear history funciona
- ✅ Dispose limpa recursos

### SpecManager Tests Atualizados

- ✅ Não espera mais que SpecManager dispare triggers
- ✅ Valida apenas que comando foi enviado
- ✅ Testa tratamento de erros

## Benefícios da Solução

1. **✅ Triggers disparam APÓS conclusão real** - Não antes
2. **✅ Validação de conteúdo** - Garante que arquivos são parseáveis
3. **✅ Sem duplicatas** - Debounce evita múltiplos triggers
4. **✅ Logs detalhados** - Fácil debugging via Output Channel
5. **✅ Testável** - Todos os componentes têm testes unitários
6. **✅ Extensível** - Fácil adicionar validação para outros tipos de operação

## Como Usar

### Criar Hook para Tasks

```typescript
{
    name: "Create GitHub Issues After Tasks",
    trigger: {
        agent: "speckit",
        operation: "tasks",  // Dispara APÓS tasks.md ser criado E validado
        timing: "after"
    },
    action: {
        type: "agent",
        parameters: {
            command: "/speckit.taskstoissues"
        }
    }
}
```

### Logs no Output Channel

Para debugar, abra o Output Channel "GatomIA - Debug":

```
[CommandCompletionDetector] Initializing file watchers...
[CommandCompletionDetector] Initialized 24 file watchers
[CommandCompletionDetector] Detected completion: speckit.tasks (file: /specs/005/tasks.md)
[CommandCompletionDetector] Successfully parsed 10 tasks from: /specs/005/tasks.md
[TriggerRegistry] Trigger fired: speckit.tasks at 2025-12-05T20:58:00Z
[HookExecutor] Executing hooks for trigger: speckit.tasks
```

## Limitações Conhecidas

1. **Delay de 2 segundos** - Há um delay intencional (debounce) para garantir que arquivos estão completos
2. **Validação limitada** - Atualmente, validação completa só para `tasks` e `taskstoissues`
3. **Dependência de file watchers** - Se VS Code não detectar mudanças, triggers não disparam

## Melhorias Futuras

1. Adicionar validação específica para cada tipo de operação (spec, plan, etc.)
2. Configurar delay de debounce via settings
3. Adicionar fallback manual para triggering
4. Integrar com eventos do parser do SpecExplorerProvider

## Referências

- Issue: #005 - MCP Hooks Integration
- PR: [Número do PR]
- Commits:
  - Criação do CommandCompletionDetector
  - Integração com extension.ts
  - Atualização dos testes
