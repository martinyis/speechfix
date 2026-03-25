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

/** Get display info for the currently selected agent */
export function getSelectedAgentDisplay(
  selectedAgentId: number | null,
  agents: Agent[],
): { name: string; subtitle: string; icon: 'sparkles' | 'person'; avatarSeed: string | null } {
  if (selectedAgentId === null) {
    return { name: 'Reflexa', subtitle: 'Default speech coach', icon: 'sparkles', avatarSeed: null };
  }
  const agent = agents.find((a) => a.id === selectedAgentId);
  if (!agent) {
    return { name: 'Reflexa', subtitle: 'Default speech coach', icon: 'sparkles', avatarSeed: null };
  }
  return { name: agent.name, subtitle: agent.type, icon: 'person', avatarSeed: agent.avatarSeed ?? agent.name };
}
