import Dexie, { type Table } from 'dexie';

export interface Company {
  id?: number;
  name: string;
  logo?: string;
  phone?: string;
  email: string;
  address?: string;
  taxId?: string;
  createdAt: Date;
}

export interface User {
  id?: number;
  companyId?: number; // Null for Super Admin
  fullName: string;
  email: string;
  passwordHash: string;
  role: 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'MANAGER' | 'CASHIER' | 'EMPLOYEE';
  phone?: string;
  address?: string;
  salary?: number;
  departmentId?: number;
  createdAt: Date;
}

export interface Department {
  id?: number;
  companyId: number;
  name: string;
  description?: string;
}

export interface Product {
  id?: number;
  companyId: number;
  name: string;
  barcode?: string;
  categoryId?: number;
  supplierId?: number;
  description?: string;
  quantity: number;
  lowStockThreshold: number;
  costPrice: number;
  sellingPrice: number;
  unit: string;
  createdAt: Date;
}

export interface Category {
  id?: number;
  companyId: number;
  name: string;
}

export interface Supplier {
  id?: number;
  companyId: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface Sale {
  id?: number;
  companyId: number;
  userId: number; // Cashier
  date: Date;
  total: number;
  tax: number;
  discount: number;
  paymentMethod: 'CASH' | 'BANK' | 'MOBILE';
  customerName?: string;
  createdAt: Date;
}

export interface SaleItem {
  id?: number;
  saleId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Purchase {
  id?: number;
  companyId: number;
  supplierId: number;
  date: Date;
  total: number;
  paymentMethod: 'CASH' | 'BANK' | 'MOBILE';
}

export interface PurchaseItem {
  id?: number;
  purchaseId: number;
  productId: number;
  quantity: number;
  costPrice: number;
}

export interface Transaction {
  id?: number;
  companyId: number;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  description?: string;
  date: Date;
  referenceId?: number; // Sale ID or Purchase ID
  referenceType?: 'SALE' | 'PURCHASE' | 'OTHER';
}

export interface Attendance {
  id?: number;
  employeeId: number;
  companyId: number;
  date: Date;
  checkIn: Date;
  checkOut?: Date;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE';
}

export class NexusDatabase extends Dexie {
  companies!: Table<Company>;
  users!: Table<User>;
  departments!: Table<Department>;
  products!: Table<Product>;
  categories!: Table<Category>;
  suppliers!: Table<Supplier>;
  sales!: Table<Sale>;
  saleItems!: Table<SaleItem>;
  purchases!: Table<Purchase>;
  purchaseItems!: Table<PurchaseItem>;
  transactions!: Table<Transaction>;
  attendance!: Table<Attendance>;

  constructor() {
    super('NexusERP_DB');
    this.version(1).stores({
      companies: '++id, name, email',
      users: '++id, companyId, email, role',
      departments: '++id, companyId, name',
      products: '++id, companyId, name, barcode, categoryId, supplierId',
      categories: '++id, companyId, name',
      suppliers: '++id, companyId, name',
      sales: '++id, companyId, userId, date',
      saleItems: '++id, saleId, productId',
      purchases: '++id, companyId, supplierId, date',
      purchaseItems: '++id, purchaseId, productId',
      transactions: '++id, companyId, type, category, date',
      attendance: '++id, employeeId, companyId, date'
    });
  }
}

export const db = new NexusDatabase();
