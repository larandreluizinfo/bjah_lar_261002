# ⚽ Futebol de Rua — Campo & Quadra

Jogo de futebol arcade em HTML5 Canvas (5 contra 5), sem dependências.
Você controla o **time azul**; o time vermelho joga com IA.

🔗 **Jogue agora no GitHub Pages:** https://larandreluizinfo.github.io/bjah_lar_261002/

## Criadores

- Bernardo
- Helena
- Arthur
- João

## Praças

| Praça | Como é |
| --- | --- |
| 🌿 **Campo** | Estádio de grama com arquibancadas, refletores e placas de publicidade. Laterais, escanteios e tiro de meta. |
| 🏀 **Quadra** | Ginásio de futsal com piso de madeira, tabelas nas paredes (a bola rebate) e garoa. |

Troque de local no botão **🏟️**, nas abas do placar ou com a tecla <kbd>E</kbd>.

## Controles

| Tecla | Ação |
| --- | --- |
| <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / setas | mover |
| <kbd>Espaço</kbd> | chutar / passar / tirar do gol |
| <kbd>Shift</kbd> | carrinho (desarme) |
| <kbd>Q</kbd> | trocar de jogador |
| <kbd>E</kbd> | trocar de local |
| <kbd>R</kbd> | reiniciar a partida |

No celular aparece um joystick virtual e os botões de chute e carrinho.

## 🎨 Closet — cores do mundo

No menu **🎨 Cores do time** dá para escolher **qualquer cor do espectro** (o seletor
de cor do navegador abre o gamut RGB completo) para:

- camisa, detalhe/gola, calção e meias;
- **chuteira** (cor do pé) e **estoque** (outro pé), desenhadas com solado e studs;
- pele e cabelo;
- estampa: listrado, horizontal, faixa, degradê ou liso.

Botões **🎲 Aleatório** (sorteia cores novas) e **↺ Padrão**.

## Como está feito

```
index.html      estrutura da página e HUD
css/style.css   estilos do placar, do closet e dos controles
js/game.js      motor do jogo (física, IA, desenho em canvas, áudio)
```

- Física da bola com altura, quique, giro e rastro.
- IA com marcação, posicionamento por setores, passes e finalizações.
- Goleiros que defendem, saem do gol e seguram chutes fortes.
- Torcida, refletores, bandeirinhas, placas, som (torcida, apito, chutes) e garoa na quadra.
