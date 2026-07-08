import React, { useState } from 'react';
import { db, type Product } from '@/src/lib/db';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { cn } from '@/src/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/table';
import { Button } from '@/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { Plus, Search, Package, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/src/components/ui/badge';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/src/lib/firebase';
import { useTranslation } from '@/src/lib/i18n';


export default function Inventory() {
  const { currentUser, currentCompany } = useAuthStore();
  const { t, formatCurrency } = useTranslation();
  
  const products = useLiveQuery(async () => {
    if (!currentUser) return [];
    if (currentUser.role === 'SUPER_ADMIN') {
      return db.products.toArray();
    }
    return currentCompany ? db.products.where('companyId').equals(currentCompany.id!).toArray() : [];
  }, [currentCompany, currentUser]);

  const allCompanies = useLiveQuery(() => db.companies.toArray());

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!currentCompany) {
      toast.error('No company selected. Please log in again or select a company.');
      return;
    }

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const quantity = parseInt(formData.get('quantity') as string) || 0;
    const lowStockThreshold = parseInt(formData.get('lowStockThreshold') as string) || 5;
    const costPrice = parseFloat(formData.get('costPrice') as string) || 0;
    const unit = (formData.get('unit') as string) || 'pcs';

    if (!name) {
      toast.error('Product name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const productId = crypto.randomUUID();
      const productData = {
        id: productId,
        companyId: currentCompany.id!,
        name,
        quantity,
        lowStockThreshold,
        costPrice,
        sellingPrice: 0, // Default to 0, will be asked at POS
        unit,
        createdAt: new Date(),
      };

      await db.products.add(productData);

      const isOffline = !navigator.onLine;

      if (!isOffline) {
        // Sync to Firestore
        try {
          const payload = {
            ...productData,
            createdAt: serverTimestamp(),
          };
          // Sanitize object to remove any wedding undefined fields that could crash Firestore
          Object.keys(payload).forEach(key => {
            if ((payload as any)[key] === undefined) {
              delete (payload as any)[key];
            }
          });
          await setDoc(doc(firestore, 'products', productId), payload);
        } catch (syncError) {
          console.error('Firestore sync failed', syncError);
        }
        toast.success('Inventory added successfully.');
      } else {
        toast.success('saving...');
      }

      setIsAddOpen(false);
    } catch (err) {
      console.error('Error adding product:', err);
      if (err instanceof Error && err.name === 'ConstraintError') {
        toast.error('A product with this barcode already exists');
      } else {
        toast.error('Failed to add product: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!editingProduct) return;

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const quantity = parseInt(formData.get('quantity') as string) || 0;
    const lowStockThreshold = parseInt(formData.get('lowStockThreshold') as string) || 5;
    const costPrice = parseFloat(formData.get('costPrice') as string) || 0;
    const unit = (formData.get('unit') as string) || 'pcs';

    if (!name) {
      toast.error('Product name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedProduct = {
        name,
        quantity,
        lowStockThreshold,
        costPrice,
        unit,
      };
      
      await db.products.update(editingProduct.id!, updatedProduct);

      const isOffline = !navigator.onLine;

      if (!isOffline) {
        // Sync to Firestore
        try {
          const payload = {
            ...editingProduct,
            ...updatedProduct,
            updatedAt: serverTimestamp(),
          };
          // Sanitize object to remove any undefined fields that could crash Firestore
          Object.keys(payload).forEach(key => {
            if ((payload as any)[key] === undefined) {
              delete (payload as any)[key];
            }
          });
          await setDoc(doc(firestore, 'products', editingProduct.id!), payload, { merge: true });
        } catch (syncError) {
          console.error('Firestore sync failed at update', syncError);
        }
        toast.success('Product updated successfully');
      } else {
        toast.success('saving...');
      }
      setIsEditOpen(false);
      setEditingProduct(null);
    } catch (err) {
      console.error('Error updating product:', err);
      toast.error('Failed to update product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this product?')) {
      await db.products.delete(id);
      
      const isOffline = !navigator.onLine;

      if (!isOffline) {
        // Sync to Firestore
        try {
          await deleteDoc(doc(firestore, 'products', id));
        } catch (syncError) {
          console.error('Firestore sync failed at delete', syncError);
        }
        toast.success('Product deleted');
      } else {
        toast.success('saving...');
      }
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('inventory')}</h1>
          <p className="text-muted-foreground">{t('stock_status')}</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" />
            {t('add_product')}
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <form onSubmit={handleAddProduct}>
              <DialogHeader>
                <DialogTitle>{t('add_product')}</DialogTitle>
                <DialogDescription>
                  Enter product details to add it to your inventory.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="name">{t('name')}</Label>
                  <Input id="name" name="name" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="unit">Unit (e.g., pcs, kg, box)</Label>
                  <Input id="unit" name="unit" defaultValue="pcs" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="quantity">Initial Quantity</Label>
                  <Input id="quantity" name="quantity" type="number" defaultValue="0" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lowStockThreshold">Low Stock Alert Level</Label>
                  <Input id="lowStockThreshold" name="lowStockThreshold" type="number" defaultValue="5" required />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="costPrice">Cost Price (ETB)</Label>
                  <Input id="costPrice" name="costPrice" type="number" step="0.01" required />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Saving...
                    </span>
                  ) : t('add_product')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Now Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(products?.reduce((acc, p) => acc + (p.costPrice * p.quantity), 0) || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">
              {products?.filter(p => p.quantity <= p.lowStockThreshold).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {products?.filter(p => p.quantity <= 0).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder={t('search')} 
                className="pl-10" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('products')}</TableHead>
                {currentUser?.role === 'SUPER_ADMIN' && <TableHead>Company</TableHead>}
                <TableHead>Stock Status</TableHead>
                <TableHead>Cost Price</TableHead>
                <TableHead>Now Balance</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts && filteredProducts.length > 0 ? (
                <>
                  {filteredProducts.map((p) => {
                    const isLowStock = p.quantity <= p.lowStockThreshold;
                    const rowValuation = p.costPrice * p.quantity;
                    
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            {p.name}
                          </div>
                        </TableCell>
                        {currentUser?.role === 'SUPER_ADMIN' && (
                          <TableCell className="text-xs">
                            {allCompanies?.find(c => c.id === p.companyId)?.name || 'N/A'}
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "font-bold",
                              p.quantity <= 0 ? "text-destructive" : isLowStock ? "text-amber-500" : "text-foreground"
                            )}>
                              {p.quantity} {p.unit}
                            </span>
                            {isLowStock && (
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatCurrency(p.costPrice)}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(rowValuation)}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => {
                              setEditingProduct(p);
                              setIsEditOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(p.id!)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={currentUser?.role === 'SUPER_ADMIN' ? 3 : 2}>TOTAL VALUATION</TableCell>
                    <TableCell>
                      {filteredProducts.reduce((acc, p) => acc + p.quantity, 0)} Items
                    </TableCell>
                    <TableCell>-</TableCell>
                    <TableCell>
                      {formatCurrency(filteredProducts.reduce((acc, p) => acc + (p.costPrice * p.quantity), 0))}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </>
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    {t('no_recent_activity')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[525px]">
          {editingProduct && (
            <form onSubmit={handleUpdateProduct}>
              <DialogHeader>
                <DialogTitle>Edit Product</DialogTitle>
                <DialogDescription>
                  Update product details in your inventory.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="edit-name">{t('name')}</Label>
                  <Input id="edit-name" name="name" defaultValue={editingProduct.name} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-unit">Unit (e.g., pcs, kg, box)</Label>
                  <Input id="edit-unit" name="unit" defaultValue={editingProduct.unit} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-quantity">Quantity</Label>
                  <Input id="edit-quantity" name="quantity" type="number" defaultValue={editingProduct.quantity} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-lowStockThreshold">Low Stock Alert Level</Label>
                  <Input id="edit-lowStockThreshold" name="lowStockThreshold" type="number" defaultValue={editingProduct.lowStockThreshold} required />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="edit-costPrice">Cost Price (ETB)</Label>
                  <Input id="edit-costPrice" name="costPrice" type="number" step="0.01" defaultValue={editingProduct.costPrice} required />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Saving...
                    </span>
                  ) : 'Update Product'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


