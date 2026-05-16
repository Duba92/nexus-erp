import React, { useState } from 'react';
import { db } from '@/src/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useTranslation } from '@/src/lib/i18n';
import {
  Card,
  CardContent,
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
import { Input } from '@/src/components/ui/input';
import { Search, User, Trash2, ShieldCheck, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/src/components/ui/badge';

export default function Users() {
  const { t } = useTranslation();
  const { currentUser } = useAuthStore();
  const users = useLiveQuery(() => db.users.toArray());
  const companies = useLiveQuery(() => db.companies.toArray());
  const [search, setSearch] = useState('');

  if (currentUser?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <ShieldCheck className="h-12 w-12 text-muted-foreground/20" />
        <p className="text-muted-foreground font-medium">Access Denied.</p>
      </div>
    );
  }

  const filteredUsers = users?.filter(u => 
    u.fullName.toLowerCase().includes(search.toLowerCase()) || 
    u.phone.toLowerCase().includes(search.toLowerCase())
  );

  const getCompanyName = (companyId?: string) => {
    if (!companyId) return 'System';
    return companies?.find(c => c.id === companyId)?.name || 'Unknown';
  };

  const handleDelete = async (id: string) => {
    if (id === currentUser.id) {
      toast.error('Cannot delete your own account');
      return;
    }
    if (confirm('Delete this user?')) {
      await db.users.delete(id);
      toast.success('User deleted');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Users</h1>
          <p className="text-muted-foreground">Manage all accounts across all companies.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search users by name or phone..." 
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
                <TableHead>User</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers && filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <User className="h-4 w-4" />
                        </div>
                        {user.fullName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{getCompanyName(user.companyId)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'SUPER_ADMIN' ? 'default' : 'secondary'}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{user.phone}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(user.id!)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No users found.
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
