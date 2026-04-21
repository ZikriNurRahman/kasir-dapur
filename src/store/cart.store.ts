import { create } from 'zustand'
import type { CartItem, Menu, PaymentMethod } from '@/types/database'

// Interface mendefinisikan semua state dan fungsi yang tersedia
interface CartStore {
  items: CartItem[]
  tableNumber: string
  paymentMethod: PaymentMethod
  addItem: (menu: Menu) => void
  decrementItem: (menuId: string) => void
  removeItem: (menuId: string) => void
  setQuantity: (menuId: string, qty: number) => void
  clearCart: () => void
  setTableNumber: (t: string) => void
  setPaymentMethod: (m: PaymentMethod) => void
  getTotal: () => number
  isReadyToCheckout: () => boolean
}

export const useCartStore = create<CartStore>()((set, get) => ({
  items: [],
  tableNumber: '',
  paymentMethod: 'CASH',

  // Tambah ke cart. Kalau sudah ada → naikkan qty saja
  addItem: (menu) => set((state) => {
    const existing = state.items.find(i => i.menuId === menu.id)
    if (existing) {
      return { items: state.items.map(i =>
        i.menuId === menu.id ? { ...i, quantity: i.quantity + 1 } : i
      )}
    }
    return { items: [...state.items, {
      menuId: menu.id, menuName: menu.name,
      unitPrice: menu.price, quantity: 1, notes: ''
    }]}
  }),

  // Kurangi qty 1. Kalau sudah 1 → hapus dari cart
  decrementItem: (menuId) => set((state) => {
    const item = state.items.find(i => i.menuId === menuId)
    if (!item) return state
    if (item.quantity <= 1) return { items: state.items.filter(i => i.menuId !== menuId) }
    return { items: state.items.map(i =>
      i.menuId === menuId ? { ...i, quantity: i.quantity - 1 } : i
    )}
  }),

  removeItem: (menuId) => set(state => ({
    items: state.items.filter(i => i.menuId !== menuId)
  })),

  setQuantity: (menuId, qty) => {
    if (qty <= 0) { get().removeItem(menuId); return }
    set(state => ({ items: state.items.map(i =>
      i.menuId === menuId ? { ...i, quantity: qty } : i
    )}))
  },

  clearCart: () => set({ items: [], tableNumber: '', paymentMethod: 'CASH' }),
  setTableNumber: (tableNumber) => set({ tableNumber }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),

  // Hitung total harga semua item di cart
  getTotal: () => get().items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),

  // Cart valid untuk checkout jika ada item dan nomor meja diisi
  isReadyToCheckout: () => get().items.length > 0 && get().tableNumber.trim().length > 0,
}))