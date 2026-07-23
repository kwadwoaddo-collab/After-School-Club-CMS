import { db } from '@/db';
import { invoiceInstalments } from '@/db/schema';
import { logger } from '@/lib/logger';
import { addMonths } from 'date-fns';

export class InstalmentService {
  /**
   * Splits a term invoice into equal monthly instalments.
   * Assumes the first instalment is due immediately on the invoiceDate,
   * and subsequent instalments are due on the same day in following months.
   */
  async createInstalmentPlan(
    organisationId: string,
    invoiceId: string,
    totalAmount: number,
    numberOfMonths: number,
    invoiceDate: Date
  ): Promise<void> {
    if (numberOfMonths <= 0 || totalAmount <= 0) return;

    // Split amount evenly, rounding down to 2 decimal places.
    const splitAmount = Math.floor((totalAmount / numberOfMonths) * 100) / 100;
    
    // Any remainder due to rounding goes to the first instalment
    const remainder = Math.round((totalAmount - (splitAmount * numberOfMonths)) * 100) / 100;

    const instalmentsData = [];

    for (let i = 0; i < numberOfMonths; i++) {
      const amount = i === 0 ? splitAmount + remainder : splitAmount;
      const dueDate = addMonths(invoiceDate, i);

      instalmentsData.push({
        organisationId,
        invoiceId,
        amount: amount.toFixed(2),
        dueDate,
        status: 'pending' as const,
      });
    }

    await db.insert(invoiceInstalments).values(instalmentsData);
    logger.info(`[InstalmentService] Created \${numberOfMonths} instalments for invoice \${invoiceId}`);
  }
}

export const instalmentService = new InstalmentService();
