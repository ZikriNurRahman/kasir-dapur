// src/types/database.ts
// V4 UPDATE:
// - Tambah Branch, EmployeeCredential, OrderNotification
// - Profile: tambah branch_id, display_name, username
// - Order: tambah branch_id, cash_received
// - Roles: OWNER | ADMIN | EMPLOYEE

export type OrderStatus   = 'PENDING_PAYMENT' | 'PENDING' | 'READY' | 'COMPLETED' | 'CANCELLED'
export type PaymentMethod = 'CASH' | 'QRIS' | 'LATER'
export type OrderType     = 'DINE_IN' | 'TAKEAWAY'
export type UserRole      = 'OWNER' | 'ADMIN' | 'EMPLOYEE'
// OWNER  → bisa kelola semua cabang
// ADMIN  → kelola satu cabang (menu, laporan, pegawai cabang itu)
// EMPLOYEE → hanya bisa POS dan KDS di cabang yang ditugaskan

// Cabang toko
export interface Branch {
  id:         string
  owner_id:   string
  name:       string
  address:    string
  slug:       string
  is_active:  boolean
  created_at: string
}

// Profile user Supabase Auth
export interface Profile {
  id:           string
  role:         UserRole
  display_name: string      // nama yang tampil di header, KDS, struk
  branch_id:    string | null  // cabang yang ditugaskan (null = owner semua cabang)
  username:     string | null  // untuk login pegawai tanpa email
  created_at:   string
}

// Kategori menu per cabang
export interface Category {
  id:         string
  name:       string
  sort_order: number
  branch_id:  string
  created_at: string
}

// Setting toko — satu row per cabang
export interface StoreSettings {
  id:            number
  store_name:    string
  store_address: string
  store_social:  string
  footer_text:   string
  updated_at:    string
}

export interface Menu {
  id:           string
  name:         string
  price:        number
  category:     string
  stock:        number
  is_available: boolean
  branch_id:    string
  created_at:   string
}

export interface OrderItem {
  id:         string
  order_id:   string
  menu_id:    string | null
  menu_name:  string
  unit_price: number
  quantity:   number
  notes:      string
  is_ready:   boolean
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
  served_by:       string | null
  served_by_name:  string
  cash_received:   number   // ← V4: simpan di DB agar struk bisa dicetak kapanpun
  branch_id:       string | null
  created_at:      string
  updated_at:      string
  order_items?:    OrderItem[]
}

// Notifikasi ke pelayan bahwa pesanan READY
export interface OrderNotification {
  id:         string
  order_id:   string
  user_id:    string
  type:       string
  is_read:    boolean
  created_at: string
  orders?:    Order  // joined
}

export interface CartItem {
  menuId:    string
  menuName:  string
  unitPrice: number
  quantity:  number
  notes:     string
}