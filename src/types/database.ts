// src/types/database.ts
// V3 UPDATE:
// - OrderStatus: tambah PENDING_PAYMENT (untuk alur Midtrans QRIS)
// - Order: tambah served_by, served_by_name
// - Profile: tambah display_name
// - Tambah interface Category dan StoreSettings (baru)

export type OrderStatus   = 'PENDING_PAYMENT' | 'PENDING' | 'READY' | 'COMPLETED' | 'CANCELLED'
export type PaymentMethod = 'CASH' | 'QRIS'
export type OrderType     = 'DINE_IN' | 'TAKEAWAY'
export type UserRole      = 'OWNER' | 'EMPLOYEE'

// Profile user — terhubung ke auth.users
export interface Profile {
  id:           string
  role:         UserRole
  display_name: string  // ← baru: nama yang tampil di KDS dan struk
  created_at:   string
}

// Kategori menu — sekarang bisa diatur dari admin (tidak hardcode lagi)
export interface Category {
  id:         string
  name:       string
  sort_order: number
  created_at: string
}

// Setting toko — untuk struk dan tampilan
export interface StoreSettings {
  id:            number  // selalu 1
  store_name:    string
  store_address: string
  store_social:  string   // sosmed, e.g. "@nama_ig"
  footer_text:   string   // teks penutup di struk
  updated_at:    string
}

export interface Menu {
  id:           string
  name:         string
  price:        number
  category:     string   // nama kategori (string, bukan FK untuk simplicity)
  stock:        number
  is_available: boolean
  created_at:   string
}

export interface OrderItem {
  id:         string
  order_id:   string
  menu_id:    string | null
  menu_name:  string   // snapshot nama saat pesan
  unit_price: number   // snapshot harga saat pesan
  quantity:   number
  notes:      string
  is_ready:   boolean  // ceklis per item di KDS
}

export interface Order {
  id:              string
  order_number:    string
  table_number:    string
  customer_name:   string
  order_type:      OrderType
  total_price:     number
  payment_method:  PaymentMethod
  status:          OrderStatus
  served_by:       string | null   // ← baru: user id kasir
  served_by_name:  string          // ← baru: snapshot nama kasir
  created_at:      string
  updated_at:      string
  order_items?:    OrderItem[]
}

// CartItem — hanya di memory Zustand, tidak disimpan ke DB
export interface CartItem {
  menuId:    string
  menuName:  string
  unitPrice: number
  quantity:  number
  notes:     string
}