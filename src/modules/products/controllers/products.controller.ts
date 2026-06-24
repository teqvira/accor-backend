import { Response } from 'express';
import {
  getOptionalQueryParam,
  getParam,
  getQueryNumber,
} from '../../../shared/utils/params';
import { sendSuccess } from '../../../shared/utils/response';
import { AuthRequest } from '../../auth/types/auth.types';
import { ProductStatus, ProductType } from '../constants/products.constants';
import { productsService } from '../services/products.service';

function parseProductType(value: string | undefined): ProductType | undefined {
  if (!value) return undefined;
  return value as ProductType;
}

function parseProductStatus(value: string | undefined): ProductStatus | undefined {
  if (!value) return undefined;
  return value as ProductStatus;
}

export class ProductsController {
  async create(req: AuthRequest, res: Response): Promise<void> {
    const product = await productsService.create(req.body);
    sendSuccess(res, 'Product created successfully', { product }, 201);
  }

  async list(req: AuthRequest, res: Response): Promise<void> {
    const page = getQueryNumber(req.query.page, 1);
    const limit = getQueryNumber(req.query.limit, 20);
    const result = await productsService.list(page, limit, {
      productType: parseProductType(getOptionalQueryParam(req.query.productType)),
      status: parseProductStatus(getOptionalQueryParam(req.query.status)),
      brand: getOptionalQueryParam(req.query.brand),
      search: getOptionalQueryParam(req.query.search),
    });
    sendSuccess(res, 'Products fetched successfully', result);
  }

  async getById(req: AuthRequest, res: Response): Promise<void> {
    const product = await productsService.getById(getParam(req.params.id));
    sendSuccess(res, 'Product fetched successfully', { product });
  }

  async update(req: AuthRequest, res: Response): Promise<void> {
    const product = await productsService.update(getParam(req.params.id), req.body);
    sendSuccess(res, 'Product updated successfully', { product });
  }

  async activate(req: AuthRequest, res: Response): Promise<void> {
    const product = await productsService.activate(getParam(req.params.id));
    sendSuccess(res, 'Product activated successfully', { product });
  }

  async deactivate(req: AuthRequest, res: Response): Promise<void> {
    const product = await productsService.deactivate(getParam(req.params.id));
    sendSuccess(res, 'Product deactivated successfully', { product });
  }
}

export const productsController = new ProductsController();
