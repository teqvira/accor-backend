import { ProductStatus, ProductType } from '../constants/products.constants';

export interface IProduct {
  _id: string;
  skuCode: string;
  name: string;
  productType: ProductType;
  brand?: string;
  status: ProductStatus;
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
  status?: ProductStatus;
  imageUrl?: string;
}

export interface UpdateProductInput {
  skuCode?: string;
  name?: string;
  productType?: ProductType;
  brand?: string | null;
  status?: ProductStatus;
  imageUrl?: string | null;
}

export interface ProductListFilters {
  productType?: ProductType;
  status?: ProductStatus;
  brand?: string;
  search?: string;
}
