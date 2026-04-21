// src/types/database.ts
// UPDATE: tambah OrderType, stock di Menu, customer_name + order_type di Order,
//         is_ready di OrderItem, Role untuk profile user

export type OrderStatus    = 'PENDING' | 'READY' | 'COMPLETED' | 'CANCELLED'
export type PaymentMethod  = 'CASH' | 'QRIS'
export type OrderType      = 'DINE_IN' | 'TAKEAWAY'  // ← baru
export type UserRole       = 'OWNER' | 'EMPLOYEE'    // ← baru

// Profile user — tersimpan di tabel profiles, terhubung ke auth.users
export interface Profile {
  id:         string
  role:       UserRole
  created_at: string
}

export interface Menu {
  id:           string
  name:         string
  price:        number
  category:     string
  stock:        number      // ← baru: jumlah stok tersedia
  is_available: boolean
  created_at:   string
  // image_url dihapus — hemat database
}

export interface OrderItem {
  id:       string
  order_id: string
  menu_id:  string | null
  menu_name:  string   // snapshot nama saat pesan
  unit_price: number   // snapshot harga saat pesan
  quantity:   number
  notes:      string
  is_ready:   boolean  // ← baru: ceklis per item di KDS
}

export interface Order {
  id:             string
  order_number:   string
  table_number:   string
  customer_name:  string       // ← baru: nama pembeli
  order_type:     OrderType    // ← baru: DINE_IN atau TAKEAWAY
  total_price:    number
  payment_method: PaymentMethod
  status:         OrderStatus
  created_at:     string
  updated_at:     string
  order_items?:   OrderItem[]  // tersedia kalau di-join saat fetch
}

// CartItem — hanya ada di memory (Zustand), tidak disimpan ke DB
export interface CartItem {
  menuId:     string
  menuName:   string
  unitPrice:  number
  quantity:   number
  notes:      string  // catatan per item (sudah ada sebelumnya, sekarang bisa diinput)
}