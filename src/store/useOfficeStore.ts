import { create } from 'zustand'

export type Role = 'administrator' | 'manager' | 'designer' | 'trainee' | 'sales' | 'auditor'

export interface Staff {
  id: string
  name: string
  role: Role
}

export interface ShopProfile {
  id: string
  name: string
}

export interface AuditEntry {
  at: string
  by: string
  action: string
}

const STORAGE_KEY = 'winner-design-office-v1'

interface OfficeState {
  staff: Staff[]
  currentId: string
  shops: ShopProfile[]
  activeShopId: string
  audit: AuditEntry[]
  current: () => Staff
  role: () => Role
  signIn: (id: string) => void
  addStaff: (name: string, role: Role) => void
  addShop: (name: string) => void
  selectShop: (id: string) => void
  record: (action: string) => void
}

function seedOffice(): Pick<OfficeState, 'staff' | 'currentId' | 'shops' | 'activeShopId' | 'audit'> {
  return {
    staff: [{ id: 'staff-admin', name: 'Local administrator', role: 'administrator' }],
    currentId: 'staff-admin',
    shops: [{ id: 'shop-main', name: 'Main showroom' }],
    activeShopId: 'shop-main',
    audit: [],
  }
}

function readOffice() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedOffice()
    const data = JSON.parse(raw) as Partial<ReturnType<typeof seedOffice>>
    const seed = seedOffice()
    return {
      staff: data.staff?.length ? data.staff : seed.staff,
      currentId: data.currentId || seed.currentId,
      shops: data.shops?.length ? data.shops : seed.shops,
      activeShopId: data.activeShopId || seed.activeShopId,
      audit: data.audit ?? [],
    }
  } catch {
    return seedOffice()
  }
}

function persist(state: OfficeState) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      staff: state.staff,
      currentId: state.currentId,
      shops: state.shops,
      activeShopId: state.activeShopId,
      audit: state.audit.slice(-200),
    }),
  )
}

const initial = readOffice()

export const useOfficeStore = create<OfficeState>((set, get) => ({
  ...initial,
  current: () => get().staff.find((person) => person.id === get().currentId) ?? get().staff[0],
  role: () => get().current().role,
  signIn: (id) => {
    const person = get().staff.find((entry) => entry.id === id)
    if (!person) return
    set({ currentId: id })
    get().record(`Signed in as ${person.name}`)
    persist(get())
  },
  addStaff: (name, role) => {
    const staff = [...get().staff, { id: `staff-${Math.random().toString(36).slice(2, 8)}`, name, role }]
    set({ staff })
    get().record(`Added ${name} as ${role}`)
    persist(get())
  },
  addShop: (name) => {
    const shops = [...get().shops, { id: `shop-${Math.random().toString(36).slice(2, 8)}`, name }]
    set({ shops })
    get().record(`Added shop ${name}`)
    persist(get())
  },
  selectShop: (id) => {
    const shop = get().shops.find((entry) => entry.id === id)
    if (!shop) return
    set({ activeShopId: id })
    get().record(`Switched to ${shop.name}`)
    persist(get())
  },
  record: (action) => {
    const audit = [...get().audit, { at: new Date().toISOString(), by: get().current().name, action }].slice(-200)
    set({ audit })
    persist(get())
  },
}))

export function canEditDesign() {
  return ['administrator', 'manager', 'designer', 'trainee'].includes(useOfficeStore.getState().role())
}

export function canSeeCost() {
  return !['trainee', 'sales'].includes(useOfficeStore.getState().role())
}

export function canApprove() {
  return ['administrator', 'manager'].includes(useOfficeStore.getState().role())
}

export const ROLE_LABELS: Record<Role, string> = {
  administrator: 'Administrator',
  manager: 'Shop manager',
  designer: 'Designer',
  trainee: 'Junior designer',
  sales: 'Sales assistant',
  auditor: 'Auditor',
}
