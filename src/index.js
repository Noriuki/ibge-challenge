import 'dotenv/config';
import fs from 'fs';

export default async function main() {
  // ? 1) Ler o CSV de entrada
  const input = parseCities();

  // ?  2) Buscar dados na API de localidades do IBGE
  const ibgeData = await getIbgeData();

  // ? 3) Gerar e salvar o resultado
  const output = generateOutput(input, ibgeData);

  // ? 4) Calcular stats
  const stats = generateStats(output);

  // ? 5) Enviar stats
  const submitResponse = await submitStats(stats);

  // ? 6) Imprimir score e feedback
  console.log(`Score: ${submitResponse?.score || 'N/A'}`);
  console.log(`Feedback: ${submitResponse?.feedback || 'N/A'}`);
}

const submitStats = async (stats) => {
  const response = await fetch(process.env.IBGE_SUBMIT_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ stats }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error('Erro ao enviar stats para a API');
  }

  return data;
}

const saveOutput = (output) => {
  const headers = Object.keys(output[0]);
  const csv = [headers.join(','), ...output.map(line => Object.values(line).join(','))].join('\n');
  fs.writeFileSync(process.env.OUTPUT_CSV, csv);
}

const generateStats = (output) => {
  const totalMunicipios = output.length;
  const totalOk = output.filter(line => line.status === 'OK').length;
  const totalNaoEncontrado = output.filter(line => line.status === 'NAO_ENCONTRADO').length;
  const totalErroApi = output.filter(line => line.status === 'ERRO_API').length;
  const popTotalOk = output.filter(line => line.status === 'OK').reduce((acc, line) => acc + line.populacao_input, 0);
  const mediasPorRegiao = calculateAveragePopulationByRegion(output);

  return {
    total_municipios: totalMunicipios,
    total_ok: totalOk,
    total_nao_encontrado: totalNaoEncontrado,
    total_erro_api: totalErroApi,
    pop_total_ok: popTotalOk,
    medias_por_regiao: mediasPorRegiao,
  };
}

const calculateAveragePopulationByRegion = (output) => {
  const acc = output.filter(line => line.status === 'OK').reduce((acc, line) => {
    const r = line.regiao;
    if (!acc[r]) acc[r] = { sum: 0, count: 0 };
    acc[r].sum += Number(line.populacao_input);
    acc[r].count += 1;
    return acc;
  }, {});

  return Object.fromEntries(
    Object.entries(acc).map(([regiao, { sum, count }]) => [regiao, sum / count]),
  );
}

const parseCities = () => {
  const csv = process.env.INPUT_CSV;

  if (!fs.existsSync(csv)) {
    throw new Error('Arquivo de entrada não encontrado');
  }

  const data = fs.readFileSync(csv, 'utf8');

  return data.split('\n').map(line => line.split(',')).slice(1).map(line => ({
    municipio: line[0],
    populacao: line[1],
  }));
}

const getIbgeData = async () => {
  const response = await fetch(`${process.env.IBGE_LOCALIDADES_BASE_URL}/municipios`);

  const data = await response.json();

  if (!response.ok || !Array.isArray(data) || data.length === 0) {
    throw new Error('Erro ao buscar dados da API do IBGE');
  }

  return data.map(item => ({
    id: item.id,
    nome: item.nome,
    uf: item?.microrregiao?.mesorregiao?.UF?.sigla || 'NAO_ENCONTRADO',
    regiao: item?.microrregiao?.mesorregiao?.UF?.regiao?.nome || 'NAO_ENCONTRADO',
  }));
}

const generateOutput = (input, ibgeData) => {
  const output = input.map(city => {
    const { city: cityInIbge, ambiguous } = findCityInIbgeData(city.municipio, ibgeData);

    const record = {
      municipio_input: city.municipio,
      populacao_input: Number(city.populacao),
      municipio_ibge: cityInIbge?.nome || 'NAO_ENCONTRADO',
      uf: cityInIbge?.uf || 'NAO_ENCONTRADO',
      regiao: cityInIbge?.regiao || 'NAO_ENCONTRADO',
      id_ibge: cityInIbge?.id || 'NAO_ENCONTRADO',
      status: cityInIbge ? 'OK' : 'NAO_ENCONTRADO',
    };

    if (ambiguous) {
      record.status = 'AMBIGUO';
    }

    return record;
  });

  saveOutput(output);

  return output;
}

const findCityInIbgeData = (city, ibgeData) => {
  let foundCity = null;
  let ambiguous = false;

  foundCity = ibgeData.find(ibgeCity => normalizeCityName(ibgeCity.nome) === normalizeCityName(city));

  if (foundCity) {
    return {
      city: foundCity,
      ambiguous: false,
    };
  }

  const target = normalizeCityName(city);

  const candidatesWithDistance = ibgeData.map(ibgeCity => ({
    ibgeCity,
    distance: levenshteinDistance(normalizeCityName(ibgeCity.nome), target),
  }));

  const maxDistance = 2;
  const minDistance = Math.min(...candidatesWithDistance.map(c => c.distance));

  if (minDistance > maxDistance) {
    return { candidates: [], ambiguous: false };
  }

  const candidates = candidatesWithDistance.filter(x => x.distance === minDistance);

  foundCity = candidates[0].ibgeCity;
  ambiguous = candidates.length > 1;

  return {
    ambiguous,
    city: foundCity,
  };
}

const normalizeCityName = (city) => {
  return city.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const levenshteinDistance = (a, b) => {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j], matrix[i][j - 1], matrix[i - 1][j - 1]) + 1;
      }
    }
  }

  return matrix[a.length][b.length];
}

main();