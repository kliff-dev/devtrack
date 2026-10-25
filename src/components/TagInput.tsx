import { useId, useRef, useState } from 'react'
import { techColor } from '../lib/colors.ts'
import { Icon } from './Icon.tsx'
import './TagInput.css'

interface TagInputProps {
  id?: string
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  suggestions?: string[]
}

/** Chip input: Enter or comma adds a tag, Backspace on an empty field removes the last one. */
export function TagInput({ id, value, onChange, placeholder, suggestions = [] }: TagInputProps) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  function commit(raw: string) {
    const next = [...value]
    for (const part of raw.split(',')) {
      const tag = part.trim()
      if (tag && !next.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
        next.push(tag)
      }
    }
    if (next.length !== value.length) onChange(next)
    setDraft('')
  }

  const remaining = suggestions.filter(
    (suggestion) => !value.some((tag) => tag.toLowerCase() === suggestion.toLowerCase()),
  )

  return (
    <div className="tag-input" onClick={() => inputRef.current?.focus()}>
      {value.map((tag) => (
        <span key={tag} className="tag-input__chip">
          <span className="tech-tag__dot" style={{ background: techColor(tag) }} />
          {tag}
          <button
            type="button"
            className="tag-input__remove"
            aria-label={`Remove ${tag}`}
            onClick={() => onChange(value.filter((existing) => existing !== tag))}
          >
            <Icon name="close" size={12} strokeWidth={2.2} />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        className="tag-input__field"
        value={draft}
        list={remaining.length ? listId : undefined}
        placeholder={value.length ? '' : placeholder}
        onChange={(event) => {
          const text = event.target.value
          if (text.includes(',')) commit(text)
          else setDraft(text)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && draft.trim()) {
            event.preventDefault()
            commit(draft)
          } else if (event.key === 'Backspace' && !draft && value.length) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={() => {
          if (draft.trim()) commit(draft)
        }}
      />
      {remaining.length > 0 && (
        <datalist id={listId}>
          {remaining.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      )}
    </div>
  )
}
