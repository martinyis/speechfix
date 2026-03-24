import { create } from 'zustand';
import type { Agent } from '../types/session';

interface AgentStore {
  agents: Agent[];
  selectedAgentId: number | null;
  setAgents: (agents: Agent[]) => void;
  addAgent: (agent: Agent) => void;
  removeAgent: (id: number) => void;
  selectAgent: (id: number | null) => void;
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: [],
  selectedAgentId: null,
  setAgents: (agents) => set({ agents }),
  addAgent: (agent) => set((s) => ({ agents: [...s.agents, agent] })),
  removeAgent: (id) => set((s) => ({ agents: s.agents.filter((a) => a.id !== id) })),
  selectAgent: (id) => set({ selectedAgentId: id }),
}));
