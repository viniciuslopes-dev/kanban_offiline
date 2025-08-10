# Kanban Offline (GitHub Pages)

Quadro Kanban minimalista, salva no `localStorage`, funciona offline (PWA) e suporta arrastar-e-soltar.

## Recursos
- Colunas editáveis (renomear, adicionar e remover)
- Cartões com título, notas e cor
- Drag & drop entre colunas, botões ← → para mobile
- Exportar/Importar JSON do board
- Tema claro/escuro (persistente)
- PWA com Service Worker e manifest (offline)

## Como publicar no GitHub Pages
1. Crie um repositório público chamado **kanban-offline** (ou outro nome).
2. Envie estes arquivos para a raiz do repositório.
3. Em **Settings → Pages**, defina **Deploy from a branch**, `main` e `/`.
4. Acesse a URL exibida em **Pages**.

> Observação: Caminhos relativos garantem que o *service worker* funcione em subpastas (`https://usuario.github.io/repositorio`).

## Uso rápido
- Clique em **+ Coluna** para criar novas colunas.
- Clique no título da coluna para renomeá-la.
- **+ Card** cria cartões; clique em **Editar** para alterar.
- Arraste cartões entre colunas ou use os botões ← →.
- **Exportar JSON** salva um backup; **Importar JSON** restaura o board.
- **Zerar Board** apaga o estado salvo.

Bom uso! 🚀
