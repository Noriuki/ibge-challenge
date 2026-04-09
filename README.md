# Prova técnica IBGE

Script em Node.js (≥18): lê um CSV de municípios, consulta a API de localidades do IBGE, gera o CSV de saída, calcula estatísticas e envia para a API de correção (quando configurado).

## Como rodar

```bash
npm install
cp .env.example .env
```

Ajuste `.env`: `INPUT_CSV` / `OUTPUT_CSV` (ex.: `input.csv`, `resultado.csv`), `IBGE_LOCALIDADES_BASE_URL`, `IBGE_SUBMIT_URL` e `ACCESS_TOKEN` conforme o enunciado.

```bash
npm start
```

(`npm start` roda `node src/index.js`.)

## Notas (decisões técnicas)

- **Fluxo:** ler entrada → buscar `/municipios` uma vez → por linha, casar nome com o cadastro IBGE → preencher nome oficial, UF (sigla), região, código e status → agregar estatísticas → POST `{ stats }` com Bearer token.

- **Normalização de nome:** trim, NFD e remoção de diacríticos + minúsculas, para alinhar input sem acento ao nome oficial.

- **Match:** igualdade após normalizar; se não houver, **Levenshtein** com distância máxima aceitável. Vários municípios com a mesma distância mínima → **`AMBIGUO`**. Distância mínima acima do limite → **`NAO_ENCONTRADO`**.

- **UF / região:** obtidos do JSON do IBGE (`microrregiao` → `mesorregiao` → `UF` → `regiao`), não inventados.

- **Estatísticas:** contagens por status; `pop_total_ok` e médias por região usam apenas linhas com status **`OK`**
