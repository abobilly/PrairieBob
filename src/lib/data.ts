import { Character, Interaction } from './types'
import { getKimbarCharacters, isKimbarRegistryLoaded } from './kimbar/registry'

export const SAMPLE_CHARACTERS: Character[] = [
  { id: 'char.kim', name: 'Kim (Player)' },
  { id: 'npc.justice_roberts', name: 'Chief Justice Roberts' },
  { id: 'npc.justice_thomas', name: 'Justice Thomas' },
  { id: 'npc.justice_alito', name: 'Justice Alito' },
  { id: 'npc.justice_sotomayor', name: 'Justice Sotomayor' },
  { id: 'npc.justice_kagan', name: 'Justice Kagan' },
  { id: 'npc.justice_gorsuch', name: 'Justice Gorsuch' },
  { id: 'npc.justice_kavanaugh', name: 'Justice Kavanaugh' },
  { id: 'npc.justice_barrett', name: 'Justice Barrett' },
  { id: 'npc.justice_jackson', name: 'Justice Jackson' },
  { id: 'npc.clerk', name: 'Court Clerk' },
  { id: 'npc.clerk_01', name: 'Clerk 01' },
  { id: 'npc.bailiff', name: 'Bailiff' },
  { id: 'npc.librarian', name: 'Librarian' },
]

/**
 * Get available characters, preferring Kimbar registry when loaded,
 * falling back to SAMPLE_CHARACTERS.
 */
export function getAvailableCharacters(): Character[] {
  if (isKimbarRegistryLoaded()) {
    const registryChars = getKimbarCharacters()
    if (registryChars.length > 0) return registryChars
  }
  return SAMPLE_CHARACTERS
}

export const DOOR_INTERACTIONS: Interaction[] = [
  {
    id: 'door_wooden',
    type: 'door',
    states: {
      closed: {
        tiles: [
          [17, 18],
          [33, 34],
        ],
        collision: true,
      },
      open: {
        tiles: [
          [19, 20],
          [35, 36],
        ],
        collision: false,
      },
    },
    defaultState: 'closed',
  },
  {
    id: 'door_north',
    type: 'door',
    states: {
      closed: {
        tiles: [
          [21, 22],
          [37, 38],
        ],
        collision: true,
      },
      open: {
        tiles: [
          [23, 24],
          [39, 40],
        ],
        collision: false,
      },
    },
    defaultState: 'closed',
  },
  {
    id: 'door_south',
    type: 'door',
    states: {
      closed: {
        tiles: [
          [25, 26],
          [41, 42],
        ],
        collision: true,
      },
      open: {
        tiles: [
          [27, 28],
          [43, 44],
        ],
        collision: false,
      },
    },
    defaultState: 'closed',
  },
]
