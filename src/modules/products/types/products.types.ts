import { ProductStatus, ProductType } from '../constants/products.constants';

export interface IProduct {
  _id: string;
  skuCode: string;
  name: string;
  productType: ProductType;
  brand?: string;
  couponCode?: string;
  status: ProductStatus;
  description?: string;
  imageUrl?: string;
  activeCoupons?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductInput {
  skuCode: string;
  name: string;
  productType: ProductType;
  brand?: string;
  couponCode?: string;
  status?: ProductStatus;
  description?: string;
  imageUrl?: string;
}

export interface UpdateProductInput {
  skuCode?: string;
  name?: string;
  productType?: ProductType;
  brand?: string | null;
  couponCode?: string | null;
  status?: ProductStatus;
  description?: string | null;
  imageUrl?: string | null;
}

export interface ProductListFilters {
  productType?: ProductType;
  status?: ProductStatus;
  brand?: string;
  search?: string;
}
