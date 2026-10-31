# Ativos da interface

## Adaptação Neres e arquivos enviados

O banner da sala de aula e os cinco retratos foram fornecidos pelo usuário. O banner é apresentado inteiro em uma seção própria da página inicial. A abertura usa somente tipografia e o símbolo SVG existente do Osler, sobre fundo sólido, sem máscaras ou gradientes de fade. Os arquivos recebidos foram convertidos para WebP para distribuição no site, preservando as dimensões e a transparência dos retratos. Os arquivos originais não foram alterados.

| Arquivo do projeto | Imagem recebida |
| --- | --- |
| `public/images/osler-educacao.webp` | `osler_header_logo_atualizada.png` |
| `public/images/founders/direcao-geral.webp` | `Osler Director General Portrait(1).png` |
| `public/images/founders/direcao-tecnica.webp` | `Pensive Doctor with Stethoscope(1).png` |
| `public/images/founders/coordenacao-pedagogica.webp` | `Confident Osler Pedagogical Coordinator(2).png` |
| `public/images/founders/corpo-clinico.webp` | `Doctor Osler Portrait with Stethoscope(1).png` |
| `public/images/founders/cirurgia.webp` | `Confident Chief Surgeon Portrait(2).png` |

A apresentação usa os cargos indicados pelos arquivos, sem inferir nomes, formação profissional, histórico ou credenciais pessoais. A página `/fundadores` descreve a contribuição conceitual de cada frente, sem apresentar esses textos como biografias pessoais. `/projeto` reúne a explicação detalhada da iniciativa educacional.

Referência visual: modelo retido Neres Restaurantes e versão aprovada “Neres Restaurantes — Fusão de modelos”, commit de referência `0778f1778333e67b68eac0f494e0544910d44b8a`. A abertura ampla, o palco interativo, a apresentação recortada das imagens, o footer e as camadas de scroll foram adaptados para o contexto educacional, mantendo as rotas e os serviços existentes do Osler.

## Imagem de acolhimento

Arquivo: `public/images/acolhimento.webp`, utilizado na seção fotográfica de acolhimento.

Imagem ilustrativa de uma conversa entre uma estudante de enfermagem e uma paciente fictícia. Produzida com a ferramenta integrada de geração de imagens e convertida para WebP para uso no site. Não retrata uma instituição, equipe, profissional ou paciente real.

Prompt utilizado:

> Use case: photorealistic-natural. Asset type: hero image for Osler, a Brazilian clinical simulation education platform. Create a premium candid editorial photograph of a young adult Brazilian woman nursing student in deep muted sage green scrubs sitting beside an older adult woman patient in a light oatmeal blouse, engaged in a warm attentive conversation in a quiet contemporary clinical education room. Eye-level medium shot, the student's face turned three quarters toward the patient, compassionate eye contact, holding a blank paper clipboard naturally in her lap, no active medical procedures. Soft natural window light from the right, warm ivory plaster walls, restrained dark forest green and beige palette, subtle film grain, honest human skin texture, calm reassuring mood, sophisticated healthcare magazine photography. Portrait 4:5 composition, both people occupy center, heads fully visible, leave some room above heads and below hands for responsive cropping. No written text, no logos, no numbers, no watermarks. No stethoscope, no medical devices, no exaggerated smiles, no blue medical stock photo lighting.

## Fontes

Nimbus Sans Regular e Bold, P052 Roman e Italic, disponibilizadas como arquivos WOFF em `public/fonts`. Licenças e exceção de fontes em `public/fonts/LICENSE.txt`.

## Identidade e pacientes

Os SVGs de identidade e de pacientes fornecidos no projeto original foram preservados. O favicon deriva do símbolo original com a cor do novo cabeçalho. Os ícones da interface são SVGs locais em `src/components/Icon.tsx`.
