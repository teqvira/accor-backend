import { NextFunction, Request, Response } from 'express';

type AsyncRequestHandler<TReq extends Request = Request> = (
  req: TReq,
  res: Response
) => Promise<void>;

export function asyncHandler<TReq extends Request = Request>(
  fn: AsyncRequestHandler<TReq>
) {
  return (req: TReq, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}
