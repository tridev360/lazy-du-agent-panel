'use strict';
//   agua_L = soma por modelo e por tipo de token (tokens x Wh por token x escala do modelo) / 1000 x (WUE + PUE x EWIF)
// Central com "~"; faixa de 1/3 a 5 vezes; "so data center" = a mesma energia x WUE. Sem tokens por tipo, nao ha agua (null).
// Trocar um fator = recalcula tudo do zero na proxima leitura (nada de agua velha guardada).
const FATORES = require('./fatores-agua.json');
const TIPOS = ['novo', 'escritaCache', 'leituraCache', 'saida'];
const CAMPO = { novo: 'entrada_nova', escritaCache: 'escrita_cache', leituraCache: 'leitura_cache', saida: 'saida' };
const finite = value => Number.isFinite(value) && value >= 0;

// Classe e escala pelo modelo (secao 1.5 da pesquisa). Modelo desconhecido fica na classe de ponta (escala 1): nunca subestima.
function classeDe(familia, modelo) {
  const m = String(modelo || '').toLowerCase(), escalas = FATORES.escala_por_modelo || {};
  if (familia === 'codex') {
    const e = escalas.codex || {};
    let escala = 1;
    if (/gpt-5\.6-sol|gpt-5\.5\b/.test(m)) escala = 1;
    else if (/mini/.test(m)) escala = e.mini ?? 0.15;
    else if (/nano|luna/.test(m)) escala = e.nano ?? 0.05;
    else if (/^gpt-5(?:\.[0-4])?(?:-codex)?$/.test(m)) escala = 0.5;
    return { base: 'codex_ponta_gpt55_gpt56sol', escala };
  }
  const e = escalas.claude || {};
  const escala = /fable|mythos/.test(m) ? e.fable ?? 2 : /sonnet/.test(m) ? e.sonnet ?? 0.5 : /haiku/.test(m) ? e.haiku ?? 0.2 : 1;
  return { base: 'claude_ponta_opus', escala };
}
// Wh de servidor de um bloco {novo, escritaCache, leituraCache, saida} de uma familia e modelo.
function energiaWh(familia, modelo, tokens, canto = 'central') {
  const { base, escala } = classeDe(familia, modelo), f = FATORES.fatores_wh_por_token[base];
  let wh = 0;
  for (const tipo of TIPOS) {
    const n = finite(tokens?.[tipo]) ? tokens[tipo] : 0;
    // Codex nao tem escrita de cache: o que vier ali conta como entrada nova
    const fator = f[CAMPO[tipo]] || f.entrada_nova;
    wh += n * fator[canto];
  }
  return wh * escala;
}
// porModelo: [{familia, modelo, novo, escritaCache, leituraCache, saida}]
function aguaDe(porModelo) {
  if (!Array.isArray(porModelo) || !porModelo.length) return null;
  let wh = 0;
  for (const linha of porModelo) wh += energiaWh(linha.familia, linha.modelo, linha);
  const kWh = wh / 1000, w = FATORES.agua_L_por_kWh_TI, faixa = FATORES.faixa || { baixo: 1 / 3, alto: 5 };
  const centralMl = Math.round(kWh * w.total.central * 1000);
  return {
    centralMl, baixoMl: Math.round(centralMl * faixa.baixo), altoMl: Math.round(centralMl * faixa.alto),
    soDataCenterMl: Math.round(kWh * w.so_data_center.central * 1000), kWh: Math.round(kWh * 10) / 10,
    litrosPorKWh: w.total.central, wue: w.so_data_center.central, versao: FATORES.versao, provisorio: false, fontes: FATORES.fontes || []
  };
}
function litros(ml, lang) {
  if (!finite(ml)) return '?';
  const liters = ml >= 1000, value = liters ? ml / 1000 : ml;
  let text; try { text = new Intl.NumberFormat(lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'pt-BR', { maximumFractionDigits: liters && value < 10 ? 1 : 0 }).format(value); } catch { text = String(Math.round(value)); }
  return text + (liters ? ' L' : ' ml');
}
// Texto do botao i (secao 4 da pesquisa) + so data center, faixa e fontes.
function dicaDe(agua) {
  if (!agua) return null;
  const fontes = (agua.fontes || []).join('; ');
  return {
    pt: 'Estimativa, não medição: Anthropic e OpenAI não publicam o consumo real dos modelos. Convertemos os tokens em energia (reler contexto guardado gasta pouco, escrever resposta gasta mais) e a energia em água usada no data center e na usina que gera a luz. O valor real pode ser de 1/3 a 5 vezes este (' + litros(agua.baixoMl, 'pt') + ' a ' + litros(agua.altoMl, 'pt') + '). Só o data center: cerca de ' + litros(agua.soDataCenterMl, 'pt') + '. Água ≈ energia dos tokens x 3,8 L por kWh (0,35 no data center + 3,5 na usina). Fontes: ' + fontes + '.',
    en: 'Estimate, not a measurement: Anthropic and OpenAI do not publish real consumption for their models. We turn tokens into energy (re-reading saved context costs little, writing replies costs more) and energy into water used by the data center and by the power plant that makes the electricity. The real value may be 1/3 to 5 times this (' + litros(agua.baixoMl, 'en') + ' to ' + litros(agua.altoMl, 'en') + '). Data center only: about ' + litros(agua.soDataCenterMl, 'en') + '. Water ≈ token energy x 3.8 L per kWh (0.35 at the data center + 3.5 at the power plant). Sources: ' + fontes + '.',
    es: 'Estimación, no medición: Anthropic y OpenAI no publican el consumo real de los modelos. Convertimos los tokens en energía (releer contexto guardado cuesta poco, escribir respuestas cuesta más) y la energía en agua usada en el centro de datos y en la central que genera la electricidad. El valor real puede ser de 1/3 a 5 veces este (' + litros(agua.baixoMl, 'es') + ' a ' + litros(agua.altoMl, 'es') + '). Solo el centro de datos: cerca de ' + litros(agua.soDataCenterMl, 'es') + '. Agua ≈ energía de los tokens x 3,8 L por kWh (0,35 en el centro de datos + 3,5 en la central). Fuentes: ' + fontes + '.'
  };
}
const ROTULO = { pt: 'água estimada (data center + usina)', en: 'estimated water (data center + power plant)', es: 'agua estimada (centro de datos + central)' };
module.exports = { FATORES, TIPOS, classeDe, energiaWh, aguaDe, dicaDe, litros, ROTULO };
