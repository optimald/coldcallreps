import type Stripe from 'stripe';

export type BillingPaymentMethod = {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
  isBackup: boolean;
};

export type BillingInvoice = {
  id: string;
  number: string | null;
  status: string | null;
  amountPaid: number;
  currency: string;
  created: number;
  hostedInvoiceUrl: string | null;
  description: string | null;
};

const BACKUP_META_KEY = 'backup_payment_method';

/** List cards + invoices for a Stripe customer; backup from customer metadata. */
export async function listCustomerBilling(
  stripe: Stripe,
  customerId: string
): Promise<{ paymentMethods: BillingPaymentMethod[]; invoices: BillingInvoice[] }> {
  const customer = await stripe.customers.retrieve(customerId);
  const defaultPm =
    !customer.deleted && customer.invoice_settings?.default_payment_method
      ? typeof customer.invoice_settings.default_payment_method === 'string'
        ? customer.invoice_settings.default_payment_method
        : customer.invoice_settings.default_payment_method.id
      : null;

  const backupPm =
    !customer.deleted && customer.metadata?.[BACKUP_META_KEY]
      ? String(customer.metadata[BACKUP_META_KEY])
      : null;

  const pms = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
    limit: 10,
  });

  let paymentMethods: BillingPaymentMethod[] = pms.data.map((pm, idx) => ({
    id: pm.id,
    brand: pm.card?.brand || null,
    last4: pm.card?.last4 || null,
    expMonth: pm.card?.exp_month || null,
    expYear: pm.card?.exp_year || null,
    isDefault: defaultPm ? pm.id === defaultPm : idx === 0,
    isBackup: false,
  }));

  const primaryId =
    paymentMethods.find((pm) => pm.isDefault)?.id || paymentMethods[0]?.id || null;
  let backupId =
    backupPm && backupPm !== primaryId && paymentMethods.some((pm) => pm.id === backupPm)
      ? backupPm
      : null;
  if (!backupId) {
    backupId = paymentMethods.find((pm) => pm.id !== primaryId)?.id || null;
  }

  paymentMethods = paymentMethods.map((pm) => ({
    ...pm,
    isDefault: pm.id === primaryId,
    isBackup: Boolean(backupId && pm.id === backupId),
  }));

  const inv = await stripe.invoices.list({ customer: customerId, limit: 30 });
  const invoices: BillingInvoice[] = inv.data.map((i) => ({
    id: i.id,
    number: i.number,
    status: i.status ?? null,
    amountPaid: i.amount_paid,
    currency: i.currency,
    created: i.created,
    hostedInvoiceUrl: i.hosted_invoice_url ?? null,
    description: i.lines?.data?.[0]?.description || i.description || null,
  }));

  return { paymentMethods, invoices };
}

export async function setPrimaryPaymentMethod(
  stripe: Stripe,
  customerId: string,
  paymentMethodId: string
) {
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });
}

export async function setBackupPaymentMethod(
  stripe: Stripe,
  customerId: string,
  paymentMethodId: string | null
) {
  await stripe.customers.update(customerId, {
    metadata: { [BACKUP_META_KEY]: paymentMethodId || '' },
  });
}
