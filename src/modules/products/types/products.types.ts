import { ProductStatus, ProductType } from '../constants/products.constants';

export interface IProduct {
  _id: string;
  skuCode: string;
  name: string;
  productType: ProductType;
  brand?: string;
  couponCode?: string;
  campaignId?: string;
  status: ProductStatus;
  description?: string;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductInput {
  skuCode: string;
  name: string;
  productType: ProductType;
  brand?: string;
  couponCode?: string;
  campaignId?: string;
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
  campaignId?: string | null;
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
