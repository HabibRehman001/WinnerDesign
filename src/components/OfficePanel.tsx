import { useState, type ChangeEvent } from 'react'
import { applyRoomFile, downloadRoomFile, purgeTrash, readBackup, restoreTrash, roomFromIfc, trashEntries, trashProject, writeBackup } from '../lib/projectFiles'
import { uid, useDesignStore } from '../store/useDesignStore'
import { ROLE_LABELS, canApprove, useOfficeStore, type Role } from '../store/useOfficeStore'
import type { ProjectStatus } from '../types'
import { fitPlan } from '../plan/camera'

const STATUSES: { id: ProjectStatus; label: string }[] = [
  { id: 'enquiry', label: 'Enquiry' },
  { id: 'survey', label: 'Survey' },
  { id: 'validate', label: 'Validate' },
  { id: 'design', label: 'Design' },
  { id: 'review', label: 'Review' },
  { id: 'quote', label: 'Quote' },
  { id: 'approval', label: 'Approval' },
  { id: 'order', label: 'Order' },
  { id: 'fulfilment', label: 'Fulfilment' },
  { id: 'install', label: 'Install' },
]

export function OfficePanel({ onClose }: { onClose: () => void }) {
  const projectName = useDesignStore((state) => state.projectName)
  const status = useDesignStore((state) => state.status)
  const history = useDesignStore((state) => state.statusHistory)
  const revision = useDesignStore((state) => state.revision)
  const locked = useDesignStore((state) => state.locked)
  const lead = useDesignStore((state) => state.lead)
  const comments = useDesignStore((state) => state.comments)
  const documents = useDesignStore((state) => state.documents)
  const surveyNotes = useDesignStore((state) => state.surveyNotes)
  const staff = useOfficeStore((state) => state.staff)
  const currentId = useOfficeStore((state) => state.currentId)
  const shops = useOfficeStore((state) => state.shops)
  const activeShopId = useOfficeStore((state) => state.activeShopId)
  const audit = useOfficeStore((state) => state.audit)
  const [comment, setComment] = useState('')
  const [staffName, setStaffName] = useState('')
  const [staffRole, setStaffRole] = useState<Role>('designer')
  const [shopName, setShopName] = useState('')
  const [trash, setTrash] = useState(trashEntries())
  const approved = canApprove()

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black/50 p-6" onClick={onClose}>
      <div className="mx-auto max-w-3xl space-y-4 rounded-md bg-shell p-5 text-sm" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold">Local office</div>
            <div className="text-xs text-white/50">{projectName} · revision {revision} {locked ? '· locked' : ''}</div>
          </div>
          <button className="rounded bg-white/10 px-3 py-1" onClick={onClose}>Close</button>
        </div>

        <section className="space-y-2">
          <h2 className="text-[11px] uppercase tracking-wider text-white/45">Project status</h2>
          <div className="flex flex-wrap gap-1">
            {STATUSES.map((entry) => (
              <button key={entry.id} onClick={() => useDesignStore.getState().setStatus(entry.id)} className={`rounded px-2 py-1 text-xs ${status === entry.id ? 'bg-winner' : 'bg-white/10'}`}>
                {entry.label}
              </button>
            ))}
          </div>
          <ul className="max-h-24 overflow-auto text-xs text-white/60">
            {history.map((event) => (
              <li key={`${event.at}-${event.status}`}>{new Date(event.at).toLocaleString()} · {event.by} · {event.status}</li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button className="rounded bg-white/10 px-2 py-1 text-xs" disabled={!approved} onClick={() => useDesignStore.getState().lockRevision()}>Lock revision</button>
            <button className="rounded bg-white/10 px-2 py-1 text-xs" disabled={!approved} onClick={() => useDesignStore.getState().openRevision()}>New revision</button>
            <button className="rounded bg-white/10 px-2 py-1 text-xs" onClick={() => useDesignStore.getState().duplicateProject()}>Duplicate project</button>
          </div>
        </section>

        <section className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-white/50">Lead source
            <input value={lead.source} onChange={(event) => useDesignStore.getState().setLead({ source: event.target.value })} className="mt-1 w-full rounded border border-white/10 bg-shell-deep px-2 py-1 text-sm text-white" />
          </label>
          <label className="text-xs text-white/50">Budget
            <input value={lead.budget} onChange={(event) => useDesignStore.getState().setLead({ budget: event.target.value })} className="mt-1 w-full rounded border border-white/10 bg-shell-deep px-2 py-1 text-sm text-white" />
          </label>
        </section>

        <section className="space-y-2">
          <h2 className="text-[11px] uppercase tracking-wider text-white/45">Survey notes</h2>
          <textarea value={surveyNotes} onChange={(event) => useDesignStore.getState().setSurveyNotes(event.target.value)} className="h-20 w-full rounded border border-white/10 bg-shell-deep px-2 py-1 text-sm" />
          <label className="block text-xs text-white/50">
            Attach a photo or note
            <input
              type="file"
              accept="image/*,.txt,.json"
              className="mt-1 block text-xs"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                const reader = new FileReader()
                reader.onload = () => {
                  const data = String(reader.result)
                  useDesignStore.getState().addDocument({
                    id: uid('doc'),
                    name: file.name,
                    privacy: 'shop',
                    note: file.type.startsWith('image/') ? 'Photograph' : 'Survey file',
                    data: data.length < 500_000 ? data : undefined,
                  })
                }
                reader.readAsDataURL(file)
              }}
            />
          </label>
          <ul className="text-xs text-white/60">
            {documents.map((document) => (
              <li key={document.id}>{document.name} · {document.privacy} · {document.note}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-[11px] uppercase tracking-wider text-white/45">Customer comments</h2>
          <div className="flex gap-2">
            <input value={comment} onChange={(event) => setComment(event.target.value)} className="flex-1 rounded border border-white/10 bg-shell-deep px-2 py-1" />
            <button
              className="rounded bg-winner px-2"
              onClick={() => {
                if (!comment.trim()) return
                useDesignStore.getState().addComment(comment.trim())
                setComment('')
              }}
            >
              Add
            </button>
          </div>
          <ul className="text-xs text-white/60">
            {comments.map((entry) => (
              <li key={entry.id}>{entry.by}: {entry.text}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-[11px] uppercase tracking-wider text-white/45">People and shops</h2>
          <select value={currentId} onChange={(event) => useOfficeStore.getState().signIn(event.target.value)} className="w-full rounded border border-white/10 bg-shell-deep px-2 py-1">
            {staff.map((person) => (
              <option key={person.id} value={person.id}>{person.name} · {ROLE_LABELS[person.role]}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <input value={staffName} onChange={(event) => setStaffName(event.target.value)} placeholder="Name" className="flex-1 rounded border border-white/10 bg-shell-deep px-2 py-1" />
            <select value={staffRole} onChange={(event) => setStaffRole(event.target.value as Role)} className="rounded border border-white/10 bg-shell-deep px-2 py-1">
              {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
              ))}
            </select>
            <button className="rounded bg-white/10 px-2" onClick={() => staffName.trim() && useOfficeStore.getState().addStaff(staffName.trim(), staffRole)}>Add</button>
          </div>
          <select value={activeShopId} onChange={(event) => useOfficeStore.getState().selectShop(event.target.value)} className="w-full rounded border border-white/10 bg-shell-deep px-2 py-1">
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>{shop.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <input value={shopName} onChange={(event) => setShopName(event.target.value)} placeholder="New shop" className="flex-1 rounded border border-white/10 bg-shell-deep px-2 py-1" />
            <button className="rounded bg-white/10 px-2" onClick={() => shopName.trim() && useOfficeStore.getState().addShop(shopName.trim())}>Add shop</button>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-[11px] uppercase tracking-wider text-white/45">Room capture</h2>
          <div className="flex flex-wrap gap-2">
            <button className="rounded bg-white/10 px-2 py-1 text-xs" onClick={downloadRoomFile}>Export room JSON</button>
            <label className="rounded bg-white/10 px-2 py-1 text-xs">
              Import room JSON
              <input type="file" accept="application/json,.json" className="hidden" onChange={(event) => readJson(event, (data) => { applyRoomFile(data); fitPlan() })} />
            </label>
            <label className="rounded bg-white/10 px-2 py-1 text-xs">
              Import IFC
              <input
                type="file"
                accept=".ifc,text/plain"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => {
                    try {
                      const parsed = roomFromIfc(String(reader.result))
                      applyRoomFile(parsed.room)
                      fitPlan()
                      window.alert(`Imported ${parsed.room.walls.length} walls. Ignored ${parsed.ignored} other IFC entities.`)
                    } catch (error) {
                      window.alert(error instanceof Error ? error.message : 'IFC import failed')
                    }
                  }
                  reader.readAsText(file)
                }}
              />
            </label>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-[11px] uppercase tracking-wider text-white/45">Recovery</h2>
          <div className="flex flex-wrap gap-2">
            <button className="rounded bg-white/10 px-2 py-1 text-xs" onClick={() => { writeBackup(); window.alert('Backup saved on this computer.') }}>Save backup now</button>
            <button className="rounded bg-white/10 px-2 py-1 text-xs" onClick={() => restoreSlot('a')}>Restore latest backup</button>
            <button className="rounded bg-white/10 px-2 py-1 text-xs" onClick={() => restoreSlot('b')}>Restore previous backup</button>
            <button className="rounded bg-white/10 px-2 py-1 text-xs" onClick={() => { trashProject(); setTrash(trashEntries()) }}>Move project to trash</button>
            <button className="rounded bg-white/10 px-2 py-1 text-xs" onClick={() => { purgeTrash(); setTrash([]) }}>Empty trash</button>
          </div>
          <ul className="text-xs text-white/60">
            {trash.map((entry, index) => (
              <li key={entry.at}>
                {entry.name} · {new Date(entry.at).toLocaleString()}{' '}
                <button className="text-[#7ec8ff]" onClick={() => { restoreTrash(index); fitPlan() }}>Restore</button>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-[11px] uppercase tracking-wider text-white/45">Audit</h2>
          <ul className="max-h-28 overflow-auto text-xs text-white/60">
            {audit.slice().reverse().map((entry) => (
              <li key={`${entry.at}-${entry.action}`}>{new Date(entry.at).toLocaleString()} · {entry.by} · {entry.action}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}

function readJson(event: ChangeEvent<HTMLInputElement>, apply: (data: unknown) => void) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      apply(JSON.parse(String(reader.result)))
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'That file could not be read.')
    }
  }
  reader.readAsText(file)
}

function restoreSlot(slot: 'a' | 'b') {
  const raw = readBackup(slot)
  if (!raw) {
    window.alert('That backup is empty.')
    return
  }
  useDesignStore.getState().loadDocument(JSON.parse(raw))
  fitPlan()
}
