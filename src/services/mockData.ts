import { Participant, ContestState } from '../types/contest';

export const INITIAL_PARTICIPANTS: Participant[] = [
  {
    id: 'p_01',
    name: 'Carlos',
    pin: '1001',
    dishName: 'Bao de Carrillera al Vino Tinto',
    ingredients: ['Carrillera ibérica', 'Pan bao al vapor', 'Cebolla encurtida', 'Cilantro fresco', 'Reducción de Rioja'],
    description: 'Carrillera de cerdo ibérico cocinada a baja temperatura durante 12 horas, deshilachada en bao esponjoso con toque cítrico.',
    photoUrl: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=800&q=80',
    tastingOrder: 1,
    tastingTime: '14:00'
  },
  {
    id: 'p_02',
    name: 'Marta',
    pin: '1002',
    dishName: 'Croqueta Líquida de Boletus y Trufa',
    ingredients: ['Boletus edulis', 'Trufa negra de Soria', 'Leche fresca de caserío', 'Panko japonés'],
    description: 'Bechamel ultra cremosa infusionada con setas de temporada y corazón meloso de trufa con rebozado crujiente de panko.',
    photoUrl: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=800&q=80',
    tastingOrder: 2,
    tastingTime: '14:15'
  },
  {
    id: 'p_03',
    name: 'Javier',
    pin: '1003',
    dishName: 'Tartar de Atún Rojo sobre Brioche Tostado',
    ingredients: ['Atún rojo de almadraba', 'Aguacate', 'Sésamo tostado', 'Aceite de sésamo', 'Brioche artesanal'],
    description: 'Atún rojo cortado a cuchillo con aliño asiático ligero sobre lámina crujiente de brioche caramelizado en mantequilla tostada.',
    photoUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=800&q=80',
    tastingOrder: 3,
    tastingTime: '14:30'
  },
  {
    id: 'p_04',
    name: 'Elena',
    pin: '1004',
    dishName: 'Gyoza Crujiente de Pulpo a la Gallega',
    ingredients: ['Pulpo gallego', 'Pimentón de la Vera', 'Espuma de patata', 'Masa de gyoza', 'Sal Maldon'],
    description: 'Fusión gallego-japonesa con guiso de pulpo marcado a la plancha sobre crema aireada de cachelos y AOVE arbequina.',
    photoUrl: 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?auto=format&fit=crop&w=800&q=80',
    tastingOrder: 4,
    tastingTime: '14:45'
  },
  {
    id: 'p_05',
    name: 'David',
    pin: '1005',
    dishName: 'Taco de Cochinita Pibil con Xnipec',
    ingredients: ['Aguja de cerdo', 'Achiote de Yucatán', 'Tortilla de maíz nixtamalizado', 'Cebolla morada', 'Habanero suave'],
    description: 'Cerdo marinado en naranja agria y especias mayas, horneado envuelto en hoja de plátano con toque fresco de lima.',
    photoUrl: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=800&q=80',
    tastingOrder: 5,
    tastingTime: '15:00'
  },
  {
    id: 'p_06',
    name: 'Laura',
    pin: '1006',
    dishName: 'Canelón de Rabo de Toro con Beurre Blanc',
    ingredients: ['Rabo de toro estofado', 'Pasta fresca al huevo', 'Beurre blanc al Pedro Ximénez', 'Ciboulette'],
    description: 'Tradición cordobesa reducida a fuego lento durante 8 horas, envuelta en pasta fina con salsa untuosa al jerez dulce.',
    photoUrl: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80',
    tastingOrder: 6,
    tastingTime: '15:15'
  },
  {
    id: 'p_07',
    name: 'Pablo',
    pin: '1007',
    dishName: 'Zamburiña Gratinada con Alioli de Ajo Negro',
    ingredients: ['Zamburiñas frescas', 'Ajo negro fermentado', 'Panko de hierbas', 'Lima rallada'],
    description: 'Zamburiñas de ría horneadas con velo cremoso de ajo negro y costra crujiente de hierbas aromáticas.',
    photoUrl: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80',
    tastingOrder: 7,
    tastingTime: '15:30'
  },
  {
    id: 'p_08',
    name: 'Lucía',
    pin: '1008',
    dishName: 'Tortillita de Camarones Crujiente',
    ingredients: ['Camarón de estero', 'Harina de garbanzo', 'Cebolleta fresca', 'Perejil rizado', 'AOVE picual'],
    description: 'Encaje translúcido y crujiente frito al segundo, receta clásica de Sanlúcar de Barrameda con camarón vivo.',
    photoUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
    tastingOrder: 8,
    tastingTime: '15:45'
  },
  {
    id: 'p_09',
    name: 'Andrés',
    pin: '1009',
    dishName: 'Pintxo de Solomillo con Foie y Reducción de Oporto',
    ingredients: ['Solomillo de ternera gallega', 'Foie mi-cuit', 'Oporto dulce', 'Sal en escamas', 'Pan rústico'],
    description: 'Clásico de la alta taberna donostiarra: medallón al punto exacto con escalope de foie flambeado y glaseado noble.',
    photoUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
    tastingOrder: 9,
    tastingTime: '16:00'
  },
  {
    id: 'p_10',
    name: 'Sara',
    pin: '1010',
    dishName: 'Salmorejo Cordobés Ahumado con Huevo y Jamón',
    ingredients: ['Tomate de rama', 'AOVE ahumado al roble', 'Pan de telera', 'Jamón ibérico de bellota', 'Huevo de codorniz'],
    description: 'Emulsión densa y aterciopelada con notas sutiles de humo de leña de olivo y virutas crujientes de bellota 100%.',
    photoUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
    tastingOrder: 10,
    tastingTime: '16:15'
  }
];

export const INITIAL_CONTEST_STATE: ContestState = {
  id: 'eurotapa_2026',
  title: 'EuroTapa 2026 — Edición Especial',
  phase: 'SORTEO',
  adminPin: '9999',
  participants: INITIAL_PARTICIPANTS,
  votes: {},
  activeTastingId: 'p_01',
  gala: {
    currentVoterIndex: 0,
    step: 'ESPERANDO',
    revealedTapaIds: []
  },
  updatedAt: new Date().toISOString()
};
