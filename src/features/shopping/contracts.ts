import { z } from "zod";

export const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T12:00:00Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  });
export const money = z.number().finite().min(0).max(1000000);
export const currencyCode = z.string().regex(/^[A-Z]{3}$/);
export const receiptPurchaseSchema = z.object({
  purchaseDate: calendarDate.nullable(),
  currency: currencyCode.nullable(),
  subtotal: money.nullable(),
  tax: money.nullable(),
  discount: money.nullable(),
  total: money.nullable(),
  confirmed: z.boolean(),
});
export const receiptLinePriceSchema = z.object({
  total: money.nullable(),
  discount: money.nullable(),
  // Total paid for this line after line discounts; never a per-unit price.
});
export const priceObservationSchema = z.object({
  sourceUrl: z
    .string()
    .url()
    .refine((value) => {
      try {
        const url = new URL(value);
        return (
          url.protocol === "https:" &&
          !url.username &&
          !url.password &&
          !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/i.test(
            url.hostname,
          )
        );
      } catch {
        return false;
      }
    })
    .optional(),
  price: money,
  amount: z.number().finite().positive().max(1000000),
  unit: z.enum(["g", "ml", "each"]),
  currency: currencyCode,
  date: calendarDate,
  store: z.string().trim().min(1).max(200),
  conditions: z.string().max(300),
  confirmed: z.boolean(),
});
export type PriceObservation = z.infer<typeof priceObservationSchema>;
export const shoppingItemSchema = z.object({
  id: z.string().max(300),
  name: z.string().trim().min(1).max(300),
  quantity: z.string().max(150),
  checked: z.boolean(),
  createdAt: z.string().max(40),
  productId: z.string().max(200).optional(),
});
export type ShoppingItem = z.infer<typeof shoppingItemSchema>;
export const shoppingStateSchema = z.object({
  list: z.array(shoppingItemSchema).max(300),
  dismissed: z.array(z.string().max(300)).max(1000),
  prices: z.record(z.string().max(200), priceObservationSchema),
});
