import { Router, Request, Response } from 'express';
import { getExchangeRates, SUPPORTED_CURRENCY_CODES } from '../services/exchangeRateService';

const router = Router();

/**
 * GET /api/exchange-rates
 * Returns latest cached exchange rates with BDT as base
 */
router.get('/exchange-rates', async (_req: Request, res: Response) => {
  try {
    const data = await getExchangeRates();
    return res.json(data);
  } catch (error: any) {
    console.error('Failed to get exchange rates:', error);
    return res.status(503).json({
      error: 'Exchange rate service currently unavailable',
      message: error.message,
    });
  }
});

/**
 * GET /api/exchange-rates/currencies
 * Returns list of supported currencies
 */
router.get('/exchange-rates/currencies', (_req: Request, res: Response) => {
  return res.json({
    currencies: SUPPORTED_CURRENCY_CODES,
    default: 'BDT',
  });
});

export default router;

