# AGENTS.md

## Regra obrigatória: commit e push

Toda alteração feita neste repositório deve ser commitada e enviada para o GitHub.
Não deixe mudanças sem commit no working tree.

Fluxo obrigatório ao término de qualquer tarefa:

```bash
git add -A
git commit -m "<descrição curta da alteração>"
git push origin main
```

- Verifique `git status` antes de commitar e confirme que só arquivos intencionais estão incluídos.
- Nunca commite segredos, credenciais ou `.env`.
- Se o GitHub Pages falhar no build, corrija e faça novo commit + push até o deploy passar.