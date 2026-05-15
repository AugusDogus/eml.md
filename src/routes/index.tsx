import { createFileRoute } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { convertEmlFileToMarkdown, type ConvertedEmail } from '../lib/emlToMarkdown'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [converted, setConverted] = useState<ConvertedEmail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState('Drop an .eml file to convert it locally.')

  async function handleFiles(files: FileList | File[]) {
    const file = Array.from(files).find(
      (entry) => entry.name.toLowerCase().endsWith('.eml') || entry.type === 'message/rfc822',
    )

    if (!file) {
      setError('Please choose a .eml file.')
      return
    }

    setError(null)
    setStatus(`Converting ${file.name} on this device...`)

    try {
      const result = await convertEmlFileToMarkdown(file)
      setConverted(result)
      setStatus(`${file.name} converted. Nothing was uploaded.`)
    } catch (conversionError) {
      setConverted(null)
      setError(
        conversionError instanceof Error
          ? conversionError.message
          : 'Could not parse that .eml file.',
      )
      setStatus('Conversion failed.')
    }
  }

  async function copyMarkdown() {
    if (!converted) return

    await navigator.clipboard.writeText(converted.markdown)
    setStatus('Markdown copied to clipboard.')
  }

  function downloadMarkdown() {
    if (!converted) return

    const url = URL.createObjectURL(
      new Blob([converted.markdown], { type: 'text/markdown;charset=utf-8' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = converted.fileName
    link.click()
    URL.revokeObjectURL(url)
    setStatus(`Downloaded ${converted.fileName}.`)
  }

  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top_left,#164e63,transparent_34rem),#020617] px-5 py-8 text-slate-100 sm:px-8 sm:py-12">
      <section className="mx-auto flex max-w-6xl flex-col gap-8">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-300">
            Offline .eml to Markdown
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            eml.md
          </h1>
          <p className="max-w-2xl text-lg text-slate-300">
            Drop an email file, extract the conversation with postal-mime, and
            copy or download clean Markdown for pasting into an agent chat.
            Everything runs locally in your browser.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <button
            type="button"
            className={`group flex min-h-96 flex-col items-center justify-center rounded-3xl border border-dashed p-8 text-center shadow-2xl transition ${
              isDragging
                ? 'border-sky-300 bg-sky-400/15 shadow-sky-950/50'
                : 'border-white/20 bg-white/5 shadow-slate-950/30 hover:border-sky-300/70 hover:bg-white/10'
            }`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setIsDragging(false)
              void handleFiles(event.dataTransfer.files)
            }}
          >
            <span className="rounded-full border border-sky-300/30 bg-sky-300/10 px-4 py-2 text-sm font-semibold text-sky-200">
              Choose .eml
            </span>
            <span className="mt-6 text-2xl font-semibold">
              Drop your email here
            </span>
            <span className="mt-3 max-w-md text-slate-300">
              Or click this area to pick a file. Headers are ignored except for
              basic participant labels that make the thread easier to read.
            </span>
            <span className="mt-8 text-sm text-slate-400">{status}</span>
            <input
              ref={inputRef}
              className="hidden"
              type="file"
              accept=".eml,message/rfc822"
              onChange={(event) => {
                if (event.currentTarget.files) void handleFiles(event.currentTarget.files)
                event.currentTarget.value = ''
              }}
            />
          </button>

          <div className="flex min-h-96 flex-col rounded-3xl border border-white/10 bg-slate-950/80 shadow-2xl shadow-slate-950/30">
            <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
                  Markdown output
                </p>
                <p className="font-medium text-slate-200">
                  {converted?.fileName || 'No file converted yet'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-full bg-sky-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!converted}
                  onClick={() => void copyMarkdown()}
                >
                  Copy
                </button>
                <button
                  type="button"
                  className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!converted}
                  onClick={downloadMarkdown}
                >
                  Download
                </button>
              </div>
            </div>

            {error ? (
              <div className="p-5 text-sm text-red-300">{error}</div>
            ) : (
              <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-5 text-sm leading-6 text-slate-300">
                {converted?.markdown ||
                  '# Conversation preview\n\nConverted Markdown will appear here after you drop an .eml file.'}
              </pre>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
