/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Role = 'super_admin' | 'admin' | 'staff' | 'accounting' | 'karyawan' | string;

export interface UserRole {
  uid: string;
  email: string;
  password?: string;
  role: Role;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  phone: string;
  email: string;
  company: string;
  address: string;
}

export interface BankAccount {
  id: string;
  bank_code: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  initial_balance: number;
  current_balance: number;
}

export interface BankMutation {
  id: string;
  mutation_code: string;
  bank_account_id: string;
  type: 'Masuk' | 'Keluar';
  category: string;
  amount: number;
  description: string;
  transaction_date: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  phone: string;
  contactPerson: string;
  address: string;
  bankAccount?: string; // Nomor Rekening
  bankName?: string;     // Nama Bank
  businessType?: string; // Badan Usaha
  email?: string;        // Email
}

export interface TaxPayment {
  id: string;
  txId: string;
  payDate: string;
  amount: number;
  payerId: string;
  payerName: string;
  receiptPhoto?: string;
  bankAccount: string;
}

export interface ServicePayment {
  id: string;
  txId: string;
  serviceDate: string;
  kmService: number;
  amount: number;
  servicerId: string;
  servicerName: string;
  receiptPhoto?: string;
  bankAccount: string;
}

export interface Vehicle {
  id: string;
  plateNumber: string; // e.g. B 9182 SQA
  type: string; // e.g. Engkel Box, Pick Up L300
  driverName: string;
  status: 'Available' | 'On Delivery' | 'Maintenance';
  // Optional and new fields
  code?: string;
  chassisNumber?: string;
  color?: string;
  year?: string;
  taxAnnualDate?: string;
  taxMonthlyDate?: string;
  photoUrl?: string;
  picId?: string;
  picName?: string;
  taxPayments?: TaxPayment[];
  servicePayments?: ServicePayment[];
}

export interface Equipment {
  id: string;
  code: string; // tool_code - e.g., TL-WOOD-2026-0001
  tool_code?: string; // database compatibility
  name: string;
  category: 'Stationary Machinery' | 'Power Tools' | 'Hand Tools' | 'Pneumatic Tools';
  brand: string;
  serial_number?: string;
  power_specs?: string;
  condition_status: 'Siap Pakai' | 'Minta Servis' | 'Rusak Total' | 'Mata Pisau Tumpul';
  loan_status: 'Tersedia' | 'Dipakai Produksi';
  photo_path?: string;
  photoUrl?: string; // alias for display
  created_at?: string;
  location?: string;
  model?: string;
  price?: number;
  picId?: string;
  picName?: string;
  status_alat?: 'Baru' | 'Terpakai';

  // For backwards compatibility
  condition?: 'Baik' | 'Perlu Servis' | 'Rusak';
  lastServiced?: string;
}

export interface ToolLoan {
  id: string;
  loan_code: string; // LON-WD-2026-0001
  tool_id: string;
  craftsman_employee_id: string;
  pic_gudang_id: string;
  project_name?: string;
  loan_date: string;
  actual_return_date?: string;
  notes_loan?: string;
  notes_return?: string;
  photo_return?: string;
  loan_status: 'Aktif Dipakai' | 'Sudah Kembali';
}

export interface InventoryItem {
  id: string;
  code: string; // Barcode code
  name: string;
  category: string;
  stock: number;
  unit: string;
  price: number;
  location: string;
  description: string;
  lastUpdated: string;
  initialStock?: number;
  hasMinStock?: boolean;
  minStockLimit?: number;
  photoUrl?: string;
}

export interface InventoryCategory {
  id: string;
  name: string;
  description?: string;
}

export interface InventoryWarehouse {
  id: string;
  name: string;
  location?: string;
  photoUrl?: string;
  description?: string;
}

export interface RmrItem {
  id: string;
  source: 'stok' | 'manual';
  itemId?: string;
  name: string;
  qty: number;
  unit: string;
  price: number;
  subTotal: number;
  notes?: string;
}

export interface MaterialRequest {
  id: string;
  code: string; // RMR-xxxx
  projectName: string;
  requesterName: string;
  itemsList: string;
  date: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Purchased';
  giverName?: string; // Nama Pemberi otomatis (read-only dari logged in user)
  items?: RmrItem[]; // Menyimpan list detail bahan
  totalAmount?: number; // Total harga semua bahan RMR
  supplierName?: string; // Tambahan: Nama Supplier
}

export interface PurchaseOrder {
  id: string;
  code: string; // PO-xxxx
  supplierId: string;
  supplierName: string;
  itemsList: string;
  date: string;
  totalAmount: number;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Invoiced';
}

export interface PurchaseInvoice {
  id: string;
  code: string; // PINV-xxxx
  poId: string;
  poCode: string;
  supplierName: string;
  date: string;
  totalAmount: number;
  status: 'Pending' | 'Paid' | 'Completed';
  paymentAccount: string;
}

export interface GoodsReceipt {
  id: string;
  code: string; // GRN-xxxx
  invoiceId: string;
  invoiceCode: string;
  supplierName: string;
  date: string;
  itemsReceived: string;
  receivedBy: string;
  status?: 'Pending' | 'Setuju' | 'Tolak';
}

export interface Survey {
  id: string;
  code: string; // SRV-xxxx
  customerId: string;
  customerName: string;
  surveyAddress: string;
  date: string;
  depositAmount: number;
  depositStatus: string;
  surveyorName: string;
  notes: string;
  itemsList?: string;
  paymentMethod?: string;
  bankAccountId?: string;
  status?: 'Pending' | 'Selesai' | 'Batal';
  attachments?: string[];
}

export interface Quotation {
  id: string;
  code: string; // QTN-xxxx
  surveyId: string;
  surveyCode: string;
  customerName: string;
  customerAddress: string;
  projectName: string;
  surveyorName: string;
  date: string; // invoiceDate
  itemsList: string;
  subTotal: number;
  discount: number;
  discountType?: 'percentage' | 'nominal';
  ppn: number;
  shipping: number;
  surveyDeposit: number;
  totalAmount: number;
  paidAmount?: number;
  hasDiscount?: boolean;
  hasPpn?: boolean;
  hasShipping?: boolean;
  hasSurveyDeposit?: boolean;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Completed' | 'Partial' | 'Paid';
  paymentAttachments?: string[];
  skNotes?: string;
  customerId?: string;
}

export interface CatalogProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  sku?: string;
  link?: string;
  images: string[];
  category?: string;
}

export interface SalesInvoice {
  id: string;
  code: string; // SINV-xxxx
  quotationId: string;
  quotationCode: string;
  customerName: string;
  date: string;
  itemsSubTotal?: number;
  discount?: number;
  discountType?: 'percentage' | 'nominal';
  ppn?: number;
  shipping?: number;
  surveyDeposit?: number;
  totalAmount: number;
  paidAmount: number;
  hasDiscount?: boolean;
  hasPpn?: boolean;
  hasShipping?: boolean;
  hasSurveyDeposit?: boolean;
  status: 'Lunas' | 'Sebagian' | 'Draft' | 'Belum Bayar';
  paymentMethod?: string;
  paymentAccount: string;
  debtStatus?: string;
  itemsList?: string; // JSON string of items
  skNotes?: string;
  surveyId?: string;
  customerId?: string;
  surveyorName?: string;
  customerAddress?: string;
  dueDate?: string;
  tempoDays?: number;
}

export interface SalaryPayroll {
  id: string;
  employeeId: string;
  employeeName: string;
  nip: string;
  monthYear: string;
  basicSalary: number;
  bonus: number;
  deductions: number;
  totalPaid: number;
  status: 'Pending' | 'Diterima';
  paymentDate: string;
}

export interface StaffCashAdvance {
  id: string;
  code: string; // ADV-xxxx
  employeeId: string;
  employeeName: string;
  date: string;
  amount: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  paymentSource?: 'Kas Harian' | 'Kas Bank';
  bankAccountId?: string;
}

export interface OpnamItem {
  id: string;
  name: string;
  dimension?: string;
  price: number;
  qty: number;
  subtotal: number;
}

export interface CraftsmanWorkReport {
  id: string;
  code: string; // OPN-xxxx
  projectName: string;
  craftsmanName: string;
  workDescription: string;
  date: string;
  appraisalValue: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  salesInvoiceId?: string;
  salesInvoiceCode?: string;
  items?: OpnamItem[];
}

export interface Project {
  id: string;
  name: string;
  clientName: string;
  location: string;
  status: 'Planning' | 'Design' | 'Sourcing' | 'Execution' | 'Completed';
  budget: number;
  totalCost: number;
  startDate: string;
  endDate: string;
  description: string;
}

export interface Employee {
  id: string; // YYYYMM001
  name: string;
  nickname?: string;
  nip: string; // This might be used as the generated ID
  role: string;
  phone: string;
  email: string;
  status: 'Aktif' | 'Cuti' | 'Keluar';
  type?: 'Harian' | 'Borongan';
  join_date?: string;
  ktp_number?: string;
  gender?: 'Laki-laki' | 'Perempuan';
  pob?: string;
  dob?: string;
  address?: string;
  religion?: 'Islam' | 'Kristen' | 'Katolik' | 'Hindu' | 'Buddha' | 'Konghucu';
  bank_account?: string;
  bank_name?: string;
  baseSalary?: number; // Static Salary
  photo_url?: string;
  ktp_photo_url?: string;
  department?: 'Kitchenset' | 'Finishing' | 'Wall Moulding' | 'Sipil';
  shirt_size?: 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL';
  shoe_size?: number;
  nfcUid?: string;
}

export interface WeeklyPayroll {
  id: string;
  employeeId: string;
  employeeName: string;
  weekStartDate: string;
  weekEndDate: string;
  type: 'Harian' | 'Borongan';
  dailyRate: number;
  workloadRate: number;
  allowanceKC: number;
  allowanceWM: number;
  bonusAttendance: number; // Derived automatically now
  bonusCleanliness: number;
  monthlySalaryAmount: number;
  isMonthlyRoleActive: boolean;
  totalGaji: number;
  status: 'Pending' | 'Approved' | 'Paid';
  bankAccountId?: string;
  approvedBy?: string;
  paymentDate?: string;
  presenceDays?: number; // Added for automatic bonus
  overtimePay?: number; // Added for overtime calculation
  lateFines?: number; // Deductions
}

export interface Transaction {
  id: string;
  code: string;
  type: 'Pemasukan' | 'Pengeluaran' | 'Income' | 'Expense';
  category: string;
  amount: number;
  date: string;
  description: string;
  account?: string; // petty cash or corporate bank
  projectId?: string;
  salesInvoiceId?: string;
}

export interface AttendanceLog {
  id: string;
  employeeId: string;
  employeeName: string;
  time?: string;
  date?: string;
  nip?: string;
  deviceUid?: string;
  status?: string; // e.g. "On-Time", "Terlambat"
  timestamp: string; // For original schema compatibility
  method: 'NFC' | 'Biometric' | 'Manual' | 'Barcode';
  type: 'In' | 'Out' | 'Check-In' | 'Check-Out' | 'Lembur-In' | 'Lembur-Out';
  category?: 'KC' | 'WM'; // Mandatory selection
  lateMinutes?: number;
  lateFine?: number;
  isOvertime?: boolean;
  autoCheckout?: boolean;
}

export interface CompanySetting {
  fonnteToken: string;
  biometricEnabled: boolean;
  companyName: string;
  companyTagline?: string;
  companyAddress: string;
  autoDatabaseMigration: boolean;
  dbVersion: number;
  hostingerSyncEnabled?: boolean;
  hostingerApiUrl?: string;
  hostingerAutoPush?: boolean;
  // Branding & UI Customization
  logoUrl?: string;
  themeColor?: string;
  fontFamily?: string;
  // Print & Report Models
  reportSignatureUrl?: string;
  reportLetterheadUrl?: string; // Kop Surat
  invoiceLayout?: 'standard' | 'modern' | 'minimalist';
  receiptLayout?: 'standard' | 'modern' | 'minimalist';
  suratJalanLayout?: 'standard' | 'modern' | 'minimalist';
  // Customizable WhatsApp notification settings
  whatsappTemplateProjectNew?: string;
  whatsappTemplateProjectUpdate?: string;
  whatsappTemplateOrderSales?: string;
  whatsappTemplateOrderPurchase?: string;
  whatsappTemplateTaskLoan?: string;
  whatsappTemplateTaskReturn?: string;
  whatsappAutoProject?: boolean;
  whatsappAutoOrder?: boolean;
  whatsappAutoTask?: boolean;
  // Report period settings
  reportStartDate?: string;
  reportEndDate?: string;
  reportSignerName?: string;
  reportSignerTitle?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  whatsappSent: boolean;
  whatsappMessage?: string;
}

export interface RoleDefinition {
  id: string;
  name: string;
  permissions: string[]; // List of accesses (e.g., menu IDs)
}

export interface StockLedger {
  id: string;
  itemId: string;
  itemName: string;
  itemCategory: string;
  type: 'Inflow' | 'Outflow';
  source: string; // e.g. "Sourcing STB GRN-1234", "Manual Barcode", "RMR Checkout"
  date: string;
  qty: number;
  unit: string;
  remainingStock: number;
  itemMode?: 'stock' | 'manual';
}

export interface DBState {
  inventory: InventoryItem[];
  projects: Project[];
  employees: Employee[];
  transactions: Transaction[];
  attendance: AttendanceLog[];
  settings: CompanySetting;
  notifications: AppNotification[];
  dbVersion: number;
  customers: Customer[];
  suppliers: Supplier[];
  vehicles: Vehicle[];
  equipments: Equipment[];
  toolLoans?: ToolLoan[]; // Woodworking tool loan registry
  materialRequests: MaterialRequest[];
  purchaseOrders: PurchaseOrder[];
  purchaseInvoices: PurchaseInvoice[];
  goodsReceipts: GoodsReceipt[];
  surveys: Survey[];
  quotations: Quotation[];
  salesInvoices: SalesInvoice[];
  salaries: SalaryPayroll[];
  cashAdvances: StaffCashAdvance[];
  craftsmanReports: CraftsmanWorkReport[];
  bank_accounts: BankAccount[];
  bank_mutations: BankMutation[];
  weeklyPayrolls: WeeklyPayroll[];
  users: UserRole[];
  roles?: RoleDefinition[];
  categories: InventoryCategory[];
  warehouses: InventoryWarehouse[];
  stockLedgers?: StockLedger[];
  customUnits?: string[];
  catalogProducts?: CatalogProduct[];
  closedPeriods?: ClosedPeriod[];
}

export interface ClosedPeriod {
  id: string;
  periodName: string;
  closingDate: string;
  closedBy: string;
  notes?: string;
  totalItems: number;
}

