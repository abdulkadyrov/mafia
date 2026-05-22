import React from 'react'
import { Player, Phase } from '../game/types'

export type GameState = {
  players: Player[]
  phase: Phase
  round: number
}

const initialState: GameState = {
  players: [],
  phase: 'Lobby',
  round: 0
}

const GameStateContext = React.createContext<{
  state: GameState
  setState: React.Dispatch<React.SetStateAction<GameState>>
} | null>(null)

export const GameStateProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [state, setState] = React.useState<GameState>(initialState)
  return <GameStateContext.Provider value={{ state, setState }}>{children}</GameStateContext.Provider>
}

export function useGameState() {
  const ctx = React.useContext(GameStateContext)
  if (!ctx) throw new Error('useGameState must be used inside GameStateProvider')
  return ctx
}
