import { db } from '../db';
import { bills, payments } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Script to generate payments for all bills that don't have payment structures
 */
async function generateMissingPayments() {
  console.log('🔍 Finding bills without payments...');

  // Find all bills that don't have any payments
  const billsWithoutPayments = await db
    .select({
      id: bills.id,
      title: bills.title,
      paymentType: bills.paymentType,
      startDate: bills.startDate,
      totalAmount: bills.totalAmount,
      schedulePayment: bills.schedulePayment,
      scheduleCustom: bills.scheduleCustom,
      costs: bills.costs,
      endDate: bills.endDate,
    })
    .from(bills)
    .leftJoin(payments, eq(bills.id, payments.billId))
    .where(sql`${payments.id} IS NULL`);

  console.log(`📊 Found ${billsWithoutPayments.length} bills without payments`);

  let successCount = 0;
  let errorCount = 0;

  for (const bill of billsWithoutPayments) {
    try {
      console.log(`⚡ Generating payments for bill: ${bill.title} (${bill.id})`);
      
      const paymentsToCreate = [];

      switch (bill.paymentType) {
        case 'unique':
          // Single payment for unique bills
          paymentsToCreate.push({
            billId: bill.id,
            paymentNumber: 1,
            scheduledDate: bill.startDate,
            amount: bill.totalAmount,
            status: 'pending' as const,
          });
          break;

        case 'recurrent':
        case 'auto-generated':
          // Generate multiple payments based on schedule
          const maxPayments = 12; // Default to 12 payments
          let paymentNumber = 1;
          let currentDate = new Date(bill.startDate);
          const endDate = bill.endDate ? new Date(bill.endDate) : null;

          if (bill.schedulePayment === 'custom' && bill.scheduleCustom && bill.scheduleCustom.length > 0) {
            // Custom schedule
            bill.scheduleCustom.forEach((dateStr, index) => {
              const amount = bill.costs && bill.costs[index] 
                ? parseFloat(bill.costs[index].toString())
                : parseFloat(bill.totalAmount.toString()) / bill.scheduleCustom!.length;
              
              paymentsToCreate.push({
                billId: bill.id,
                paymentNumber: index + 1,
                scheduledDate: dateStr,
                amount: amount.toString(),
                status: 'pending' as const,
              });
            });
          } else {
            // Standard schedule (weekly, monthly, quarterly, yearly)
            while (paymentNumber <= maxPayments && (!endDate || currentDate <= endDate)) {
              const amount = bill.costs && bill.costs[paymentNumber - 1]
                ? parseFloat(bill.costs[paymentNumber - 1].toString())
                : parseFloat(bill.totalAmount.toString()) / maxPayments;

              paymentsToCreate.push({
                billId: bill.id,
                paymentNumber,
                scheduledDate: currentDate.toISOString().split('T')[0],
                amount: amount.toString(),
                status: 'pending' as const,
              });

              // Calculate next payment date
              switch (bill.schedulePayment) {
                case 'weekly':
                  currentDate.setDate(currentDate.getDate() + 7);
                  break;
                case 'monthly':
                  currentDate.setMonth(currentDate.getMonth() + 1);
                  break;
                case 'quarterly':
                  currentDate.setMonth(currentDate.getMonth() + 3);
                  break;
                case 'yearly':
                  currentDate.setFullYear(currentDate.getFullYear() + 1);
                  break;
                default:
                  // Default to monthly if schedule not specified
                  currentDate.setMonth(currentDate.getMonth() + 1);
              }

              paymentNumber++;
            }
          }
          break;

        default:
          console.warn(`⚠️ Unsupported payment type: ${bill.paymentType} for bill ${bill.id}`);
          errorCount++;
          continue;
      }

      // Insert the payments
      if (paymentsToCreate.length > 0) {
        await db.insert(payments).values(paymentsToCreate);
        console.log(`✅ Generated ${paymentsToCreate.length} payments for bill: ${bill.title}`);
        successCount++;
      }

    } catch (error) {
      console.error(`❌ Error generating payments for bill ${bill.id}:`, error);
      errorCount++;
    }
  }

  console.log(`\n📊 Payment generation completed:`);
  console.log(`✅ Successfully processed: ${successCount} bills`);
  console.log(`❌ Errors: ${errorCount} bills`);
  
  // Verify the results
  const totalPaymentsAfter = await db.select({
    count: sql<number>`count(*)`
  }).from(payments);
  
  console.log(`📈 Total payments in database: ${totalPaymentsAfter[0].count}`);
}

export { generateMissingPayments };

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateMissingPayments()
    .then(() => {
      console.log('🎉 Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}