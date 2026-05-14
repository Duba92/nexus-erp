import React, { useState } from 'react';
import { db, type Product } from '@/src/lib/db';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, Package, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

export default function Inventory() {
  const { currentCompany } = useAuthStore();
  const products = useLiveQuery(() => 
    currentCompany ? db.products.where('companyId').equals(currentCompany.id!).toArray() : []
  , [currentCompany]);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.barcode?.includes(search)
  );

  const handleAddProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentCompany) return;

    const formData = new FormData(e.currentTarget);
    
    try {
      await db.products.add({
        companyId: currentCompany.id!,
        name: formData.get('name') as string,
        barcode: formData.get('barcode') as string,
        quantity: parseInt(formData.get('quantity') as string),
        lowStockThreshold: parseInt(formData.get('lowStockThreshold') as string),
        costPrice: parseFloat(formData.get('costPrice') as string),
        sellingPrice: parseFloat(formData.get('sellingPrice') as string),
        unit: formData.get('unit') as string,
        createdAt: new Date(),
      });

      toast.success('Product added successfully');
      setIsAddOpen(false);
    } catch (err) {
      toast.error('Failed to add product');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this product?')) {
      await db.products.delete(id);
      toast.success('Product deleted');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">Monitor and manage your stock levels.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <form onSubmit={handleAddProduct}>
              <DialogHeader>
                <DialogTitle>Add New Product</DialogTitle>
                <DialogDescription>
                  Enter product details to add it to your inventory.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="name">Product Name</Label>
                  <Input id="name" name="name" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="barcode">Barcode / SKU</Label>
                  <Input id="barcode" name="barcode" />
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
                <div className="grid gap-2">
                  <Label htmlFor="costPrice">Cost Price ($)</Label>
                  <Input id="costPrice" name="costPrice" type="number" step="0.01" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sellingPrice">Selling Price ($)</Label>
                  <Input id="sellingPrice" name="sellingPrice" type="number" step="0.01" required />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Add Product</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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
                placeholder="Search by name or barcode..." 
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
                <TableHead>Product</TableHead>
                <TableHead>Barcode</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Margin</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts && filteredProducts.length > 0 ? (
                filteredProducts.map((p) => {
                  const isLowStock = p.quantity <= p.lowStockThreshold;
                  const margin = (((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100).toFixed(1);
                  
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          {p.name}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.barcode || '-'}</TableCell>
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
                      <TableCell>${p.costPrice.toFixed(2)}</TableCell>
                      <TableCell>${p.sellingPrice.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-none">
                          {margin}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon">
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
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    No products found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}


