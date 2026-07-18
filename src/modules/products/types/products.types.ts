import { ProductStatus, ProductType } from '../constants/products.constants';

export interface IProduct {
  _id: string;
  skuCode: string;
  name: string;
  productType: ProductType;
  brand?: string;
  description?: string;
  color?: string;
  status: ProductStatus;
  imageUrl?: string;
  activeCoupons?: number;
  totalCouponGenerated?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductInput {
  skuCode: string;
  name?: string;
  productType: ProductType;
  brand?: string;
  description?: string;
  color?: string;
  status?: ProductStatus;
  imageUrl?: string;
}

export interface UpdateProductInput {
  skuCode?: string;
  name?: string;
  productType?: ProductType;
  brand?: string | null;
  description?: string | null;
  color?: string | null;
  status?: ProductStatus;
  imageUrl?: string | null;
}

export interface ProductListFilters {
  productType?: ProductType;
  status?: ProductStatus;
  brand?: string;
  search?: string;
}
