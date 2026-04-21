export type OrderStatus = 'PENDING' | 'READY' | 'COMPLETED' | 'CANCELLED'
export type PaymentMethod = 'CASH' | 'QRIS'

export interface Menu {
  id: string
  name: string
  price: number
  category: string
  image_url: string | null
  is_available: boolean
  created_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  menu_id: string | null
  menu_name: string    // Snapshot nama saat pesan
  unit_price: number   // Snapshot harga saat pesan
  quantity: number
  notes: string
}

export interface Order {
  id: string
  order_number: string
  table_number: string
  total_price: number
  payment_method: PaymentMethod
  status: OrderStatus
  created_at: string
  updated_at: string
  order_items?: OrderItem[]  // Tersedia kalau di-join saat fetch
}

// CartItem hanya ada di memory (Zustand), tidak disimpan ke DB
export interface CartItem {
  menuId: string
  menuName: string
  unitPrice: number
  quantity: number
  notes: string
}