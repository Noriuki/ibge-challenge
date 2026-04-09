# Prova técnica IBGE

Enriquecimento de municípios com a API de localidades do IBGE, geração de CSV, estatísticas e envio para correção automática.

**Requisito:** Node.js ≥ 18.

---

## Como rodar

**1. Instalar dependências**

```bash
npm install
```

**2. Variáveis de ambiente**

```bash
cp .env.example .env
```

Edite `.env` e preencha, no mínimo:

| Variável | Descrição |
|----------|-----------|
| `INPUT_CSV` | Caminho do CSV de entrada (ex.: `input.csv`) |
| `OUTPUT_CSV` | Caminho do CSV gerado (ex.: `resultado.csv`) |
| `IBGE_LOCALIDADES_BASE_URL` | Base da API de localidades (enunciado) |
| `IBGE_SUBMIT_URL` | URL da Edge Function de envio |
| `ACCESS_TOKEN` | JWT do login (Supabase) |

**3. Executar**

```bash
npm start
```

Equivale a `node src/index.js`.

---

## Decisões técnicas

**Pipeline** — Ler o CSV → `GET /municipios` uma vez → por linha, casar o nome ao cadastro IBGE → preencher nome oficial, UF (sigla), região, código IBGE e status → calcular agregados → `POST` JSON `{ stats }` com `Authorization: Bearer …`.

**Nomes** — Normalização com trim, Unicode NFD e remoção de marcas diacríticas, em minúsculas, para equiparar input sem acentuação ao nome oficial.

**Matching** — Primeiro igualdade na forma normalizada; senão, distância de **Levenshtein** com limiar máximo. Empate na melhor distância entre vários municípios → `AMBIGUO`. Melhor distância acima do limiar → `NAO_ENCONTRADO`.

**UF e região** — Extraídos do payload do IBGE (`microrregiao` → `mesorregiao` → `UF` → `regiao`).

**Estatísticas** — Contagens por status; `pop_total_ok` e médias por região consideram apenas linhas com status `OK`.
