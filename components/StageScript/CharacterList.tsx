import React from 'react'
import { Users } from 'lucide-react'
import { Character } from '../../types'

interface Props {
  characters: Character[]
  editingCharacterId: string | null
  editingPrompt: string
  onEdit: (charId: string, prompt: string) => void
  onSave: (charId: string, prompt: string) => void
  onCancel: () => void
}

const CharacterList: React.FC<Props> = ({
  characters,
  editingCharacterId,
  editingPrompt,
  onEdit,
  onSave,
  onCancel
}) => {
  return (
    <section>
      <h3 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-4 flex items-center gap-2">
        <Users className="w-3 h-3" /> 演员表
      </h3>
      <div className="space-y-1">
        {characters.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-3 text-xs text-[var(--text-tertiary)] group cursor-default p-2 rounded hover:bg-[var(--nav-hover-bg)] transition-colors"
          >
            <div className="w-1.5 h-1.5 bg-[var(--border-secondary)] rounded-full group-hover:bg-[var(--text-tertiary)] transition-colors"></div>
            <span className="truncate group-hover:text-[var(--text-secondary)]">
              {c.name}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] font-mono shrink-0">
              {c.gender}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

export default CharacterList
