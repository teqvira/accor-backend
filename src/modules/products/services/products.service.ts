import { ConflictError, NotFoundError } from '../../../shared/utils/errors';
import { productRepository } from '../repositories/product.repository';
import {
  CreateProductInput,
  IProduct,
  ProductListFilters,
  UpdateProductInput,
} from '../types/products.types';

function sanitizeProduct(product: IProduct) {
  return {
    id: product._id,
    skuCode: product.skuCode,
    name: product.name,
    productType: product.productType,
    brand: product.brand,
    couponCode: product.couponCode,
    campaignId: product.campaignId,
    status: product.status,
    description: product.description,
    imageUrl: product.imageUrl,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export class ProductsService {
  async create(input: CreateProductInput) {
    const existing = await productRepository.findBySkuCode(input.skuCode);
    if (existing) {
      throw new ConflictError(
        'A product with this SKU code already exists',
        `create: duplicate skuCode=${input.skuCode}`
      );
    }

    const product = await productRepository.create({
      skuCode: input.skuCode,
      name: input.name,
      productType: input.productType,
      brand: input.brand,
      couponCode: input.couponCode,
      campaignId: input.campaignId,
      status: input.status ?? 'active',
      description: input.description,
      imageUrl: input.imageUrl,
    });

    return sanitizeProduct(product);
  }

  async list(page = 1, limit = 20, filters: ProductListFilters = {}) {
    const { items, total } = await productRepository.findAll(page, limit, filters);
    return {
      items: items.map(sanitizeProduct),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getById(id: string) {
    const product = await productRepository.findById(id);
    if (!product) {
      throw new NotFoundError('Product not found', `getById: id=${id}`);
    }
    return sanitizeProduct(product);
  }

  async update(id: string, input: UpdateProductInput) {
    const product = await productRepository.findById(id);
    if (!product) {
      throw new NotFoundError('Product not found', `update: id=${id}`);
    }

    if (input.skuCode && input.skuCode !== product.skuCode) {
      const existing = await productRepository.findBySkuCode(input.skuCode);
      if (existing && existing._id !== id) {
        throw new ConflictError(
          'A product with this SKU code already exists',
          `update: duplicate skuCode=${input.skuCode}`
        );
      }
    }

    const updated = await productRepository.update(id, {
      skuCode: input.skuCode ?? product.skuCode,
      name: input.name ?? product.name,
      productType: input.productType ?? product.productType,
      brand: input.brand !== undefined ? input.brand : product.brand ?? null,
      couponCode:
        input.couponCode !== undefined ? input.couponCode : product.couponCode ?? null,
      campaignId:
        input.campaignId !== undefined ? input.campaignId : product.campaignId ?? null,
      status: input.status ?? product.status,
      description:
        input.description !== undefined ? input.description : product.description ?? null,
      imageUrl: input.imageUrl !== undefined ? input.imageUrl : product.imageUrl ?? null,
    });

    if (!updated) {
      throw new NotFoundError('Product not found', `update: id=${id}`);
    }

    return sanitizeProduct(updated);
  }

  async activate(id: string) {
    const product = await productRepository.setStatus(id, 'active');
    if (!product) {
      throw new NotFoundError('Product not found', `activate: id=${id}`);
    }
    return sanitizeProduct(product);
  }

  async deactivate(id: string) {
    const product = await productRepository.setStatus(id, 'inactive');
    if (!product) {
      throw new NotFoundError('Product not found', `deactivate: id=${id}`);
    }
    return sanitizeProduct(product);
  }
}

export const productsService = new ProductsService();
