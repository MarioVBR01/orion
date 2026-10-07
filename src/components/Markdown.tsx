import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** Markdown con GFM (tablas, checklists, enlaces) y estilos propios (.md en index.css). */
export function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`md ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
