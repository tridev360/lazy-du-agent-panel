'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Locale = require('../public/locale.js');

test('Spanish covers the active views, controls, help and new delivery copy', () => {
  const labels = {
    Home:'Inicio', Team:'Equipo', Usage:'Uso', Projects:'Proyectos', Queue:'Cola',
    'Feed your AI':'Alimenta tu IA', 'Preferences':'Preferencias', 'Connect my task folder':'Conectar mi carpeta de tareas',
    'What you used and delivered':'Lo que usaste y entregaste', 'Known team connections':'Conexiones conocidas del equipo',
    'Registered dated tasks':'Tareas registradas con fecha', 'Completed':'Completadas', 'Remaining credit':'Crédito restante',
    'Offline':'Sin conexión', 'Last successful reading':'Última lectura correcta', 'Retry':'Reintentar',
    'Controls and usage':'Controles y uso', 'Created this work':'Creó este trabajo', 'No proven link':'Sin vínculo comprobado',
    'See delivery':'Ver entrega', 'Delivery recorded':'Entrega registrada',
    'Loading stopped. Try again.':'La carga se detuvo. Inténtalo de nuevo.',
    'Starting conversation: reading unavailable':'Inicio de sesión: lectura no disponible',
    'Not all work is registered as a dated task.':'No todo el trabajo se registra como una tarea con fecha.'
  };
  for (const [source,expected] of Object.entries(labels)) assert.equal(Locale.text(source,'es'),expected,source);
  for (const k of ['Your usage appears automatically.','Reading usage metadata...','Claude usage','Taking Usage screenshots','See your local AI sessions and usage in one private place.']) assert.doesNotMatch(Locale.text(k,'es'),/consumo/i,k);
});

test('generated agent actions and corrected status labels are Spanish', () => {
  const labels={
    'Reading a file':'Leyendo un archivo', 'Editing a file':'Editando un archivo', 'Running a command':'Ejecutando un comando',
    'Calling a helper':'Llamando a un ayudante', 'Searching the web':'Buscando en la web', 'Waiting for the next activity':'Esperando la próxima actividad',
    'Waiting for your decision':'Esperando tu decisión', 'Waiting':'Esperando', 'Started this work':'Inició este trabajo', 'Started by':'Iniciado por',
    'Work without a dated task is excluded.':'Se excluye el trabajo sin una tarea con fecha.', 'Task folder not connected':'Carpeta de tareas sin conectar',
    'Agents offline':'Agentes sin conexión', 'Agents live':'Agentes en vivo', 'Reading stopped. Try again.':'La lectura se detuvo. Inténtalo de nuevo.',
    'completed':'completadas'
  };
  for(const [source,expected]of Object.entries(labels))assert.equal(Locale.text(source,'es'),expected);
  assert.equal(Locale.text('2 of 2 completed','es'),'2 de 2 completadas');
  assert.equal(Locale.text('2 de 2 concluídas','pt'),'2 de 2 concluídas');
  assert.equal(Locale.text('Controles e consumo','pt'),'Controles e consumo');
});

test('EN and PT are passed through exactly, including data and non-string values', () => {
  const data={project:'Home'};
  const values=['Home','QA','REVISOR DE TESTES','LOFI','Reading your history: 003 of 009 conversations','há 2 dias','Your project · 42%',null,undefined,42,data];
  for(const lang of ['en','en-US','pt','pt-BR','fr',undefined])for(const value of values)assert.strictEqual(Locale.text(value,lang),value);
  for(const value of [null,undefined,42,data])assert.strictEqual(Locale.text(value,'es'),value);
});

test('unknown names, identifiers, prompts, timestamps and arbitrary fragments stay untouched', () => {
  const values=['lazy-du','Home dashboard','Team-42','project-Reading-conversations','QA-r11','42%','2026-10-01T01:02:03Z','Du #4212',
    'Claude Code','Codex','Lofi Girl · lofi hip hop radio','Chillhop Music · Essentials radio',
    'Build Home and Team in this project','Finished: Team-42, project-7','Read: custom project name',
    'Project 3 days ago','called Agent-42 helper','used the terminal 2 times for Project Team','Reading your history: 2 of 3 conversations extra'];
  for(const value of values)assert.equal(Locale.text(value,'es'),value);
});

test('reading, team and forecast templates preserve all recorded numbers', () => {
  const cases=[
    ['Reading your history: 003 of 009 conversations','Leyendo tu historial: 003 de 009 sesiones'],
    ['Reading today’s sessions: 0 of 82 sessions','Leyendo las sesiones de hoy: 0 de 82 sesiones'],
    ['Reading sessions · 7 days: 18 of 207 sessions','Leyendo sesiones · 7 días: 18 de 207 sesiones'],
    ['Paused (43)','En pausa (43)'], ['Ended conversations (12)','Sesiones terminadas (12)'],
    ['OLDER CONVERSATIONS (508)','SESIONES ANTIGUAS (508)'],
    ['12 min ago','hace 12 min'], ['2 h ago','hace 2 h'], ['31 days ago','hace 31 días'],
    ['in ~15 min · estimated','en ~15 min · estimada'], ['late by ~4 min','retrasada ~4 min'],
    ['Today’s tasks · UTC: 37.5%','Tareas de hoy · UTC: 37.5%'],
    ['Declared deadline · 2026-10-01 14:35 UTC','Plazo declarado · 2026-10-01 14:35 UTC']
  ];
  for(const [source,expected]of cases)assert.equal(Locale.text(source,'es'),expected);
});

test('tool summaries translate complete known templates without touching tool counts', () => {
  assert.equal(Locale.text('called 1 helper and edited files 12 times and used the terminal 1.2K times','es'),
    'llamó a 1 ayudante y editó archivos 12 veces y usó el terminal 1.2K veces');
  assert.equal(Locale.text('read files 2 times and looked things up 1 time','es'),'leyó archivos 2 veces y investigó 1 vez');
  assert.equal(Locale.text('checked images 20 times and checked the work 1 time','es'),'revisó imágenes 20 veces y revisó el trabajo 1 vez');
  assert.equal(Locale.text('called 2 helpers','es'),'llamó a 2 ayudantes');
  for(const source of ['called 2 times','read files 2 helpers','read files 2 times and Team','read files 2 times and read files 2 times and read files 2 times and read files 2 times'])assert.equal(Locale.text(source,'es'),source);
});

test('dates, source metadata and usage range survive translated UI prefixes', () => {
  const reading='Read: 2026-10-01T14:35:22.100Z · local-project-42';
  assert.equal(Locale.text(reading,'es'),'Lectura: 2026-10-01T14:35:22.100Z · local-project-42');
  assert.equal(Locale.text('Read: 14:35 UTC','es'),'Lectura: 14:35 UTC');
  assert.equal(Locale.text('7 days · Renews Oct 1, 14:35 UTC · Read 13:05 UTC · local conversation history','es'),
    '7 días · Se renueva Oct 1, 14:35 UTC · Lectura 13:05 UTC · local conversation history');
  const range='2026-09-25 → 2026-10-01 UTC. Days already read; the first reading does not reconstruct older excluded days. Large conversations use only their opening and recent readings.';
  assert.equal(Locale.text(range,'es'),'2026-09-25 → 2026-10-01 UTC. Días ya leídos; la primera lectura no reconstruye los días antiguos excluidos. Las sesiones grandes solo usan el inicio y las lecturas recientes.');
});

test('QA is expanded and LOFI includes the music label only at the UI boundary', () => {
  for(const label of ['QA','QUALITY TESTER','REVISOR DE TESTES'])assert.equal(Locale.text(label,'es'),'TESTER DE CALIDAD');
  for(const label of ['LOFI','Lofi','LOFI · Music'])assert.equal(Locale.text(label,'es'),'LOFI · Música');
  assert.equal(Locale.text('♫ Lofi','es'),'♫ LOFI · Música');
  assert.equal(Locale.text('QA Project','es'),'QA Project');
  assert.equal(Locale.text('Lofi Girl','es'),'Lofi Girl');
});

test('regional Spanish works and the browser API needs no settings, DOM or observation', () => {
  assert.equal(Locale.text('Home','es-ES'),'Inicio');assert.equal(Locale.text('Team','ES_mx'),'Equipo');
  assert.equal(Locale.text('Home','estonian'),'Home');
  const window={};
  for(const key of ['document','localStorage','MutationObserver'])Object.defineProperty(window,key,{get(){throw new Error('Unexpected '+key+' access');}});
  const context={window};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/locale.js'),'utf8'),context);
  assert.equal(window.PanelLocale.text('Retry','es'),'Reintentar');
  assert.equal(Object.isFrozen(window.PanelLocale),true);
});
