# Feature Specification: Automatic Review Transition

**Feature Branch**: `001-auto-review-transition`  
**Created**: 2025-12-24  
**Status**: Draft  
**Input**: User description: "specificações que foram concluídas não estão indo para a aba de review isso deveria ocorrer automaticamente, após todas as tarefas de uma especificação terem sido marcadas como concluídas, ou caso o usuário clique com o botão da direita e selecione send to review precisamos corrigir esse fluxo."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Auto move when work is done (Priority: P1)

Spec owners need their completed specifications to appear in the Review tab as soon as every task linked to that spec is marked as concluída so they can hand off for approval without extra clicks.

**Why this priority**: Prevents the review backlog from stalling because owners forget to manually move the card, which currently blocks reviewers entirely.

**Independent Test**: Complete all tasks for a single specification in isolation and confirm the specification transitions to Review automatically within the promised time window.

**Acceptance Scenarios**:

1. **Given** a specification in the “Em Progresso” column with at least one tarefa pendente, **When** the final tarefa for that specification is marked concluída, **Then** the specification status updates to “Review” and the card appears in the Review tab without user action.
2. **Given** a specification already moved to Review by automation, **When** reviewers open the Review tab, **Then** the new card is visible with the completion timestamp and awaiting reviewer assignment.

---

### User Story 2 - Manual “Send to review” action (Priority: P2)

Spec owners sometimes prefer to trigger the review handoff manually (e.g., after a quick audit), so a contexto menu action must reliably move the specification to Review on demand.

**Why this priority**: Provides agency when automation is delayed or when owners deliberately override the auto-trigger after double-checking the work.

**Independent Test**: From a clean workspace, right-click an eligible specification, choose “Send to review,” and verify the Review tab reflects the change immediately and acknowledges the triggering user.

**Acceptance Scenarios**:

1. **Given** a specification that is eligible for review, **When** the user right-clicks it (em qualquer lista relevante) and selects “Send to review,” **Then** the specification status, Review tab entry, and audit log all update with the initiating user and timestamp.

---

### User Story 3 - Consistent status handling (Priority: P3)

Coordinators must trust that specs do not bounce between tabs or stay stuck when tarefas são reabertas, ensuring reviewers always see only ready items.

**Why this priority**: Maintains predictability and prevents reviewers from wasting tempo on specs that are not realmente prontas.

**Independent Test**: Simulate reopening uma tarefa after a review transition and verify the specification leaves the Review tab until it becomes eligible again.

**Acceptance Scenarios**:

1. **Given** a specification sitting in Review because all tasks were concluídas, **When** qualquer tarefa é reaberta ou marcada como pendente novamente, **Then** the specification is removed from Review and flagged back to the execution column until all tarefas return to concluídas.

---

### Edge Cases

- All but one task are concluídas, and the final one is created after the others finish; ensure the automation still re-evaluates eligibility whenever new tasks appear.
- Manual “Send to review” is executed twice (by the same or a different usuário) while the transition is already in progress; the system must ignore duplicates and surface a friendly confirmation.
- Network or sync failures occur exactly when the transition should fire; specs must retry or notify the user instead of remaining invisíveis da aba de Review.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST continuously evaluate each specification’s tarefas and flag a specification as “eligible for review” only when 100% of its tarefas estão com status concluído.
- **FR-002**: When a specification first becomes eligible, the system MUST automatically mudar o status para “Review”, mover o card para a respectiva aba e registrar o horário e usuário (ou processo) que disparou a mudança.
- **FR-003**: The Review tab MUST refresh (ou receber push) para refletir o novo card em até 10 segundos após a transição automática sem exigir reload manual da UI.
- **FR-004**: A contexto action “Send to review” MUST estar disponível para todas as especificações prontas e, ao ser acionada, executar o mesmo fluxo de transição, incluindo mensagens de sucesso e feedback imediato ao usuário.
- **FR-005**: Caso a transição manual seja solicitada para um item já em Review, the system MUST bloquear operações duplicadas e informar ao usuário que o item já está lá.
- **FR-006**: Se qualquer tarefa for reaberta depois da ida para Review, the system MUST remover o card da aba Review, restaurar o status anterior e notificar os stakeholders relevantes.
- **FR-007**: Cada transição (automática ou manual) MUST emitir telemetria e logs com ID da especificação, usuário envolvido (quando aplicável), timestamps e resultado (sucesso/falha) para auditoria.
- **FR-008**: Toda transição para Review MUST disparar notificações no canal padrão de alertas de revisão para todos os revisores ou watchers atribuídos, garantindo confirmação imediata do novo item.

### Key Entities *(include if feature involves data)*

- **Especificação**: Item principal contendo título, autor, status atual, coluna exibida e o conjunto de tarefas vinculadas; é o objeto movido entre “Em Progresso” e “Review”.
- **Tarefa**: Trabalho granular associado a uma especificação, possuindo status (pendente, em andamento, concluído) e timestamps; determina a elegibilidade da especificação.
- **Evento de Transição para Review**: Registro audível que captura fonte (automática X manual), usuário, horário e resultado; alimenta relatórios e telemetria.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% das especificações com todas as tarefas concluídas devem aparecer na aba Review em até 10 segundos após o fechamento da última tarefa, medido em ambiente de staging.
- **SC-002**: 100% das execuções do comando “Send to review” em especificações elegíveis devem resultar na transição bem-sucedida na primeira tentativa durante testes end-to-end.
- **SC-003**: 0 tickets de suporte relacionados a “spec concluída não aparece em Review” durante o ciclo de release imediatamente após o lançamento.
- **SC-004**: 100% dos eventos de ida ou saída de Review devem constar nos logs/telemetria com os campos obrigatórios (ID da especificação, tipo de trigger, usuário quando houver, timestamp e status).

## Clarifications

### Session 2025-12-24

- Q: Who must be notified when a spec moves to Review automatically or via manual command? → A: Notify all assigned reviewers/watchers via the existing review-alert channel.

## Assumptions

- “Todas as tarefas concluídas” significa que nenhum item associado à especificação está marcado como pendente ou em andamento; tarefas recém-criadas contam imediatamente para a verificação.
- A ação “Send to review” permanece disponível nos context menus das listas onde as especificações são exibidas atualmente (explorer e painel principal).
- Notificações de erro podem usar os mesmos mecanismos já existentes para alertas no produto; não é necessário criar novos canais específicos.
