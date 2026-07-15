export const COLORES_JUGADOR = [
  { id: 'azul',   nombre: 'AZUL',   css: '#00B4D8', cssBorde: '#7DE8FF', hex: 0x00b4d8, hexBorde: 0x7de8ff },
  { id: 'verde',  nombre: 'VERDE',  css: '#4ADE80', cssBorde: '#A7F3C8', hex: 0x4ade80, hexBorde: 0xa7f3c8 },
  { id: 'rosado', nombre: 'ROSADO', css: '#FF5FA2', cssBorde: '#FFB3D1', hex: 0xff5fa2, hexBorde: 0xffb3d1 },
  { id: 'morado', nombre: 'MORADO', css: '#A855F7', cssBorde: '#D8B4FE', hex: 0xa855f7, hexBorde: 0xd8b4fe },
];

export function colorPorId(id) {
  return COLORES_JUGADOR.find(c => c.id === id) || COLORES_JUGADOR[0];
}
