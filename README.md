# ⚽ Futebol de Rua

Jogo de futebol arcade em HTML5 + Canvas, sem dependências, rodando direto no GitHub Pages.

🔗 **Jogue agora:** https://larandreluizinfo.github.io/bjah_lar_261002/

## Criadores

**Bernardo, Helena, Arthur e João.**

## Locais

| Local | Descrição |
| --- | --- |
| 🏟️ **Campo** | Estádio de grama com arquibancadas lotadas, placas de LED, refletores, bandeirinhas e torcida. |
| 🏀 **Quadra** | Ginásio de futsal: piso de madeira polida, tabelas (paredes) com rebote, meia-lua das áreas e arquibancadas. |

Troque de local pelo botão no placar, pela tecla `E` ou escolhendo no menu inicial.

## Como jogar

Você comanda o **time Azul** (o jogador com anel ciano). O controle passa automaticamente
para quem está mais perto da bola — ou use `Q` para trocar na hora.

| Tecla | Ação |
| --- | --- |
| `W` `A` `S` `D` / setas | mover |
| `Espaço` | chutar, passar e finalizar (mira automática) |
| `Shift` | carrinho (desarme) |
| `Q` | trocar jogador controlado |
| `E` | trocar entre campo e quadra |
| `R` | reiniciar a partida |

No celular aparecem joystick e botões de chute/carrinho.

## Regras do jogo

- 2 tempos de 45 segundos; o time que faz gol no campo de ataque troca de lado no intervalo.
- No **campo**: lateral, escanteio e tiro de meta, com aviso na tela.
- Na **quadra**: a bola rebate nas tabelas — só sai por cima delas.
- Goleiros defendem o gol e chutam longo; chutes fortes não são dominados por jogador de linha.
- Posse de bola, placar e cronômetro ficam sempre visíveis.
- Ao abrir o jogo, uma **demonstração IA × IA** roda ao fundo do menu.

## Recursos técnicos

- Renderização em Canvas 2D com cenário pré-renderizado (grama com 5.000 tufos, madeira com veio, arquibancadas com público).
- Bola com **altura real** (pneu, quique, sombra que diminui conforme sobe) e rastro de velocidade.
- Uniformes com listras/faixas, cabeça, braços, pernas animadas e sombra projetada.
- Partículas de grama/poeira, papel picado nos gols e garoa leve na quadra.
- Áudio sintetizado na Web Audio API: torcida, apito, chute e trave.
- Placar, cronômetro, intervalo e resultado final na HUD.

## Desenvolvimento

```bash
git add -A
git commit -m "mensagem"
git push origin main
```

O GitHub Pages publica a branch `main` da raiz do repositório.
