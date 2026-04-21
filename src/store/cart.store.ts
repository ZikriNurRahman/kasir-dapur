// src/store/cart.store.ts
// UPDATE dari sebelumnya:
// - Tambah customerName dan orderType ke state
// - Tambah setCustomerName, setOrderType, setItemNotes
// - clearCart sekarang juga reset customerName & orderType

import { create } from 'zustand'
import type { CartItem, Menu, PaymentMethod, OrderType } from '@/types/database'

interface CartStore {
  items:          CartItem[]
  tableNumber:    string
  customerName:   string      // ← baru
  paymentMethod:  PaymentMethod
  orderType:      OrderType   // ← baru

  addItem:         (menu: Menu) => void
  decrementItem:   (menuId: string) => void
  removeItem:      (menuId: string) => void
  setQuantity:     (menuId: string, qty: number) => void
  setItemNotes:    (menuId: string, notes: string) => void  // ← baru
  clearCart:       () => void
  setTableNumber:  (t: string) => void
  setCustomerName: (name: string) => void                   // ← baru
  setPaymentMethod:(m: PaymentMethod) => void
  setOrderType:    (t: OrderType) => void                   // ← baru
  getTotal:        () => number
  isReadyToCheckout: () => boolean
}

export const useCartStore = create<CartStore>()((set, get) => ({
  items:         [],
  tableNumber:   '',
  customerName:  '',        // ← default kosong (opsional)
  paymentMethod: 'CASH',
  orderType:     'DINE_IN', // ← default makan di tempat

  // Tambah ke cart. Kalau sudah ada → naikkan qty saja
  addItem: (menu) => set((state) => {
    const existing = state.items.find(i => i.menuId === menu.id)
    if (existing) {
      return {
        items: state.items.map(i =>
          i.menuId === menu.id ? { ...i, quantity: i.quantity + 1 } : i
        ),
      }
    }
    return {
      items: [...state.items, {
        menuId:    menu.id,
        menuName:  menu.name,
        unitPrice: menu.price,
        quantity:  1,
        notes:     '',
      }],
    }
  }),

  // Kurangi qty 1. Kalau sudah 1 → hapus
  decrementItem: (menuId) => set((state) => {
    const item = state.items.find(i => i.menuId === menuId)
    if (!item) return state
    if (item.quantity <= 1) return { items: state.items.filter(i => i.menuId !== menuId) }
    return { items: state.items.map(i =>
      i.menuId === menuId ? { ...i, quantity: i.quantity - 1 } : i
    )}
  }),

  removeItem: (menuId) => set(state => ({
    items: state.items.filter(i => i.menuId !== menuId),
  })),

  setQuantity: (menuId, qty) => {
    if (qty <= 0) { get().removeItem(menuId); return }
    set(state => ({
      items: state.items.map(i =>
        i.menuId === menuId ? { ...i, quantity: qty } : i
      ),
    }))
  },

  // UPDATE: set catatan untuk satu item tertentu
  setItemNotes: (menuId, notes) => set(state => ({
    items: state.items.map(i =>
      i.menuId === menuId ? { ...i, notes } : i
    ),
  })),

  // Reset semua ke default termasuk field baru
  clearCart: () => set({
    items:         [],
    tableNumber:   '',
    customerName:  '',
    paymentMethod: 'CASH',
    orderType:     'DINE_IN',
  }),

  setTableNumber:   (tableNumber)   => set({ tableNumber }),
  setCustomerName:  (customerName)  => set({ customerName }),    // ← baru
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
  setOrderType:     (orderType)     => set({ orderType }),       // ← baru

  getTotal: () => get().items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),

  // Cart valid untuk checkout: ada item + nomor meja diisi
  // Nama pembeli sengaja tidak diwajibkan (opsional)
  isReadyToCheckout: () =>
    get().items.length > 0 && get().tableNumber.trim().length > 0,
}))