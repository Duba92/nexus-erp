# Security Spec for Hullee

## Data Invariants
1. A Product must belong to a valid Company.
2. Only users belonging to a Company can read/write its data (Products, Sales, Loans).
3. Super Admins can manage everything (Companies, all Users, all Data).
4. Roles (SUPER_ADMIN, COMPANY_ADMIN, etc.) are determined by the `users` collection.

## Dirty Dozen Payloads (Rejections)
1. Creating a product with a different companyId.
2. Updating a product's price to a negative value.
3. Reading another company's sales.
4. Setting oneself as a SUPER_ADMIN during registration.
5. Deleting a company as a COMPANY_ADMIN.
6. Recording a loan for a negative amount.
7. Updating createdAt timestamp.
8. Accessing PII (Full Name, Phone) of another company's employees.
9. Injecting extra fields into a Sale record.
10. Listing users without being authenticated.
11. Bypassing company ID check on list queries.
12. Modifying role in profile update.
