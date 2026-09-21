import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/database/prisma.service';
import {
  FolioDetailDto,
  FolioDto,
  FolioStatus,
  FolioTransactionDto,
  PaymentDto,
  PaymentMethod,
  PaymentStatus,
  PmsEventType,
  ReservationStatus,
  SecurityContext,
} from '@hms/api-contracts';
import { createCloudEvent, generateUuidV7 } from '@hms/shared';
import { CreateFolioDto } from '../dto/create-folio.dto';
import { PostChargeDto } from '../dto/post-charge.dto';
import { RecordPaymentDto } from '../dto/record-payment.dto';

export function computeChargePayloadHash(folioId: string, dto: PostChargeDto): string {
  const canonical = {
    folioId,
    transactionCode: dto.transactionCode.trim(),
    description: dto.description.trim(),
    amount: new Prisma.Decimal(dto.amount.trim()).toFixed(4),
    taxAmount: dto.taxAmount ? new Prisma.Decimal(dto.taxAmount.trim()).toFixed(4) : '0.0000',
    reasonCode: dto.reasonCode?.trim() || null,
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function computePaymentPayloadHash(folioId: string, dto: RecordPaymentDto): string {
  const canonical = {
    folioId,
    amount: new Prisma.Decimal(dto.amount.trim()).toFixed(4),
    paymentMethod: dto.paymentMethod,
    referenceNumber: dto.referenceNumber?.trim() || null,
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

@Injectable()
export class FolioService {
  private readonly logger = new Logger(FolioService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new billing folio for a checked-in reservation.
   * Requires mandatory persistent Idempotency-Key.
   */
  public async createFolio(
    propertyId: string,
    dto: CreateFolioDto,
    actor: SecurityContext,
    idempotencyKey: string,
  ): Promise<FolioDto> {
    if (!idempotencyKey || !idempotencyKey.trim()) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        errorCode: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Idempotency-Key header is required for creating a folio',
      });
    }

    const trimmedKey = idempotencyKey.trim();

    // 1. Check existing folio with same idempotency key
    const existingWithKey = await this.prisma.folio.findUnique({
      where: {
        uq_folio_property_idempotency: {
          propertyId,
          idempotencyKey: trimmedKey,
        },
      },
    });

    if (existingWithKey) {
      if (existingWithKey.reservationId !== dto.reservationId) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          errorCode: 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_ENTITY',
          message: `Idempotency key '${trimmedKey}' has already been used for another reservation/folio in this property`,
        });
      }
      return this.mapToFolioDto(existingWithKey);
    }

    // 2. Validate target reservation
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: dto.reservationId, propertyId, deletedAt: null },
    });
    if (!reservation) {
      throw new NotFoundException(
        `Reservation '${dto.reservationId}' not found on property '${propertyId}'`,
      );
    }

    if (reservation.status !== ReservationStatus.CHECKED_IN) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        errorCode: 'RESERVATION_NOT_CHECKED_IN',
        message: `Cannot create a folio for reservation '${reservation.confirmationNumber}' with status '${reservation.status}'. Reservation must be CHECKED_IN.`,
      });
    }

    // Auto-generate folio number if not provided
    const folioNumber = dto.folioNumber?.trim() || `F-${Date.now().toString().slice(-6)}`;
    const tenantId = actor.activeContext.hotelGroupId || reservation.propertyId;

    try {
      const created = await this.prisma.folio.create({
        data: {
          id: generateUuidV7(),
          tenantId,
          propertyId,
          reservationId: reservation.id,
          guestId: reservation.guestId,
          folioNumber,
          status: FolioStatus.OPEN,
          currency: reservation.currency,
          balance: new Prisma.Decimal(0),
          idempotencyKey: trimmedKey,
          version: 0,
          createdBy: actor.userId,
        },
      });

      this.logger.log(
        `Folio ${created.folioNumber} (${created.id}) created for reservation ${reservation.confirmationNumber} by ${actor.userId}`,
      );
      return this.mapToFolioDto(created);
    } catch (error: any) {
      if (error.code === 'P2002') {
        const reRead = await this.prisma.folio.findUnique({
          where: {
            uq_folio_property_idempotency: {
              propertyId,
              idempotencyKey: trimmedKey,
            },
          },
        });
        if (reRead) {
          if (reRead.reservationId !== dto.reservationId) {
            throw new ConflictException({
              statusCode: 409,
              error: 'Conflict',
              errorCode: 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_ENTITY',
              message: `Idempotency key '${trimmedKey}' has already been used for another reservation/folio in this property`,
            });
          }
          return this.mapToFolioDto(reRead);
        }
      }
      throw error;
    }
  }

  /**
   * Posts an immutable financial charge/credit transaction to an open folio.
   * Total financial effect is FolioTransaction.amount (taxAmount is informational only).
   */
  public async postCharge(
    propertyId: string,
    folioId: string,
    dto: PostChargeDto,
    actor: SecurityContext,
    idempotencyKey: string,
  ): Promise<FolioTransactionDto> {
    if (!idempotencyKey || !idempotencyKey.trim()) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        errorCode: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Idempotency-Key header is required for posting a charge',
      });
    }

    const trimmedKey = idempotencyKey.trim();
    const payloadHash = computeChargePayloadHash(folioId, dto);

    // 1. Check idempotency
    const existingTx = await this.prisma.folioTransaction.findUnique({
      where: {
        uq_folio_tx_property_idempotency: {
          propertyId,
          idempotencyKey: trimmedKey,
        },
      },
    });

    if (existingTx) {
      if (existingTx.payloadHash !== payloadHash) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          errorCode: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
          message: `Idempotency key '${trimmedKey}' was already used with different charge parameters`,
        });
      }
      if (existingTx.folioId !== folioId) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          errorCode: 'IDEMPOTENCY_ENTITY_CONFLICT',
          message: `Idempotency key '${trimmedKey}' was already used for a different folio`,
        });
      }
      return this.mapToFolioTransactionDto(existingTx);
    }

    // 2. Validate amount and reasonCode for credits
    const amountDecimal = new Prisma.Decimal(dto.amount.trim());
    if (amountDecimal.isZero()) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        errorCode: 'INVALID_AMOUNT',
        message: 'Charge amount cannot be zero',
      });
    }

    if (amountDecimal.isNegative() && (!dto.reasonCode || !dto.reasonCode.trim())) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        errorCode: 'REASON_CODE_REQUIRED',
        message: 'Reason code is required for credit/rebate transactions (negative amount)',
      });
    }

    const taxAmountDecimal = dto.taxAmount
      ? new Prisma.Decimal(dto.taxAmount.trim())
      : new Prisma.Decimal(0);

    // 3. Pre-flight folio and reservation validation
    const folio = await this.prisma.folio.findFirst({
      where: { id: folioId, propertyId },
    });
    if (!folio) {
      throw new NotFoundException(`Folio '${folioId}' not found on property '${propertyId}'`);
    }

    if (folio.status !== FolioStatus.OPEN) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        errorCode: 'FOLIO_ALREADY_CLOSED',
        message: `Cannot post charges to folio '${folio.folioNumber}' because it is in '${folio.status}' status`,
      });
    }

    const reservation = await this.prisma.reservation.findFirst({
      where: { id: folio.reservationId, propertyId, deletedAt: null },
    });
    if (!reservation || reservation.status !== ReservationStatus.CHECKED_IN) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        errorCode: 'RESERVATION_NOT_CHECKED_IN',
        message: 'Charges can only be posted to folios of currently CHECKED_IN reservations',
      });
    }

    const now = new Date();
    const transactionId = generateUuidV7();

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // A. Insert immutable transaction
          const createdTx = await tx.folioTransaction.create({
            data: {
              id: transactionId,
              tenantId: folio.tenantId,
              propertyId,
              folioId: folio.id,
              transactionCode: dto.transactionCode.trim(),
              description: dto.description.trim(),
              amount: amountDecimal,
              taxAmount: taxAmountDecimal,
              reasonCode: dto.reasonCode?.trim() || null,
              idempotencyKey: trimmedKey,
              payloadHash,
              postedAt: now,
              postedBy: actor.userId,
            },
          });

          // B. Update Folio balance with strict OCC: balance += amount (NOT amount + taxAmount)
          const updateRes = await tx.folio.updateMany({
            where: {
              id: folio.id,
              version: folio.version,
              status: FolioStatus.OPEN,
            },
            data: {
              balance: { increment: amountDecimal },
              version: { increment: 1 },
            },
          });

          if (updateRes.count === 0) {
            throw new ConflictException({
              statusCode: 409,
              error: 'Conflict',
              errorCode: 'OCC_CONFLICT',
              message: `Optimistic concurrency conflict while posting charge to folio '${folio.folioNumber}'. Please retry.`,
            });
          }

          // C. Emit CloudEvent CHARGE_POSTED_TO_FOLIO
          const event = createCloudEvent({
            type: PmsEventType.CHARGE_POSTED_TO_FOLIO,
            source: `https://pms.enterprise-hms.com/properties/${propertyId}/folios/${folio.id}`,
            subject: folio.id,
            propertyId,
            data: {
              propertyId,
              folioId: folio.id,
              transactionId: createdTx.id,
              transactionCode: createdTx.transactionCode,
              amount: Number(createdTx.amount),
              taxAmount: Number(createdTx.taxAmount),
              postedBy: actor.userId,
            },
          });

          await tx.outboxEvent.create({
            data: {
              id: event.id,
              specversion: event.specversion,
              type: event.type,
              source: event.source,
              subject: event.subject,
              propertyId,
              datacontenttype: event.datacontenttype,
              time: new Date(event.time),
              data: event.data as any,
              correlationId: event.correlationid,
              causationId: event.causationid,
            },
          });

          this.logger.log(
            `Charge ${createdTx.transactionCode} (${createdTx.amount}) posted to folio ${folio.folioNumber} by ${actor.userId}`,
          );

          return this.mapToFolioTransactionDto(createdTx);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          timeout: 10000,
        },
      );
    } catch (error: any) {
      if (error.code === 'P2002') {
        const reRead = await this.prisma.folioTransaction.findUnique({
          where: {
            uq_folio_tx_property_idempotency: {
              propertyId,
              idempotencyKey: trimmedKey,
            },
          },
        });
        if (reRead) {
          if (reRead.payloadHash !== payloadHash) {
            throw new ConflictException({
              statusCode: 409,
              error: 'Conflict',
              errorCode: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
              message: `Idempotency key '${trimmedKey}' was already used with different charge parameters`,
            });
          }
          return this.mapToFolioTransactionDto(reRead);
        }
      }
      throw error;
    }
  }

  /**
   * Records an immutable payment settlement against an open folio.
   * Currency is server-derived from Folio.currency; client cannot supply an FX currency.
   */
  public async recordPayment(
    propertyId: string,
    folioId: string,
    dto: RecordPaymentDto,
    actor: SecurityContext,
    idempotencyKey: string,
  ): Promise<PaymentDto> {
    if (!idempotencyKey || !idempotencyKey.trim()) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        errorCode: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Idempotency-Key header is required for recording a payment',
      });
    }

    const trimmedKey = idempotencyKey.trim();
    const payloadHash = computePaymentPayloadHash(folioId, dto);

    // 1. Check idempotency
    const existingPayment = await this.prisma.payment.findUnique({
      where: {
        uq_payment_property_idempotency: {
          propertyId,
          idempotencyKey: trimmedKey,
        },
      },
    });

    if (existingPayment) {
      if (existingPayment.payloadHash !== payloadHash) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          errorCode: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
          message: `Idempotency key '${trimmedKey}' was already used with different payment parameters`,
        });
      }
      if (existingPayment.folioId !== folioId) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          errorCode: 'IDEMPOTENCY_ENTITY_CONFLICT',
          message: `Idempotency key '${trimmedKey}' was already used for a different folio`,
        });
      }
      return this.mapToPaymentDto(existingPayment);
    }

    // 2. Validate payment amount
    const amountDecimal = new Prisma.Decimal(dto.amount.trim());
    if (amountDecimal.isNegative() || amountDecimal.isZero()) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        errorCode: 'INVALID_AMOUNT',
        message: 'Payment amount must be greater than zero',
      });
    }

    // 3. Pre-flight folio validation
    const folio = await this.prisma.folio.findFirst({
      where: { id: folioId, propertyId },
    });
    if (!folio) {
      throw new NotFoundException(`Folio '${folioId}' not found on property '${propertyId}'`);
    }

    if (folio.status !== FolioStatus.OPEN) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        errorCode: 'FOLIO_ALREADY_CLOSED',
        message: `Cannot record payment against folio '${folio.folioNumber}' because it is in '${folio.status}' status`,
      });
    }

    const now = new Date();
    const paymentId = generateUuidV7();

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // A. Insert immutable payment with server-derived folio currency
          const createdPayment = await tx.payment.create({
            data: {
              id: paymentId,
              tenantId: folio.tenantId,
              propertyId,
              folioId: folio.id,
              amount: amountDecimal,
              currency: folio.currency,
              paymentMethod: dto.paymentMethod,
              referenceNumber: dto.referenceNumber?.trim() || null,
              status: PaymentStatus.COMPLETED,
              idempotencyKey: trimmedKey,
              payloadHash,
              processedAt: now,
              processedBy: actor.userId,
            },
          });

          // B. Update Folio balance with strict OCC: balance -= amount
          const updateRes = await tx.folio.updateMany({
            where: {
              id: folio.id,
              version: folio.version,
              status: FolioStatus.OPEN,
            },
            data: {
              balance: { decrement: amountDecimal },
              version: { increment: 1 },
            },
          });

          if (updateRes.count === 0) {
            throw new ConflictException({
              statusCode: 409,
              error: 'Conflict',
              errorCode: 'OCC_CONFLICT',
              message: `Optimistic concurrency conflict while recording payment on folio '${folio.folioNumber}'. Please retry.`,
            });
          }

          // C. Emit CloudEvent PAYMENT_RECORDED
          const event = createCloudEvent({
            type: PmsEventType.PAYMENT_RECORDED,
            source: `https://pms.enterprise-hms.com/properties/${propertyId}/folios/${folio.id}`,
            subject: folio.id,
            propertyId,
            data: {
              propertyId,
              folioId: folio.id,
              paymentId: createdPayment.id,
              amount: Number(createdPayment.amount),
              currency: createdPayment.currency,
              paymentMethod: createdPayment.paymentMethod,
              processedBy: actor.userId,
            },
          });

          await tx.outboxEvent.create({
            data: {
              id: event.id,
              specversion: event.specversion,
              type: event.type,
              source: event.source,
              subject: event.subject,
              propertyId,
              datacontenttype: event.datacontenttype,
              time: new Date(event.time),
              data: event.data as any,
              correlationId: event.correlationid,
              causationId: event.causationid,
            },
          });

          this.logger.log(
            `Payment of ${createdPayment.amount} ${createdPayment.currency} recorded on folio ${folio.folioNumber} by ${actor.userId}`,
          );

          return this.mapToPaymentDto(createdPayment);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          timeout: 10000,
        },
      );
    } catch (error: any) {
      if (error.code === 'P2002') {
        const reRead = await this.prisma.payment.findUnique({
          where: {
            uq_payment_property_idempotency: {
              propertyId,
              idempotencyKey: trimmedKey,
            },
          },
        });
        if (reRead) {
          if (reRead.payloadHash !== payloadHash) {
            throw new ConflictException({
              statusCode: 409,
              error: 'Conflict',
              errorCode: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
              message: `Idempotency key '${trimmedKey}' was already used with different payment parameters`,
            });
          }
          return this.mapToPaymentDto(reRead);
        }
      }
      throw error;
    }
  }

  /**
   * Retrieves all folios associated with a specific reservation.
   */
  public async findByReservation(propertyId: string, reservationId: string): Promise<FolioDto[]> {
    const folios = await this.prisma.folio.findMany({
      where: { propertyId, reservationId },
      orderBy: { createdAt: 'asc' },
    });
    return folios.map((f) => this.mapToFolioDto(f));
  }

  /**
   * Retrieves a single folio by ID with all itemized transactions and payments.
   */
  public async findById(propertyId: string, folioId: string): Promise<FolioDetailDto> {
    const folio = await this.prisma.folio.findFirst({
      where: { id: folioId, propertyId },
      include: {
        transactions: { orderBy: { postedAt: 'asc' } },
        payments: { orderBy: { processedAt: 'asc' } },
      },
    });

    if (!folio) {
      throw new NotFoundException(`Folio '${folioId}' not found on property '${propertyId}'`);
    }

    return {
      ...this.mapToFolioDto(folio),
      transactions: folio.transactions.map((t) => this.mapToFolioTransactionDto(t)),
      payments: folio.payments.map((p) => this.mapToPaymentDto(p)),
    };
  }

  public mapToFolioDto(folio: any): FolioDto {
    return {
      id: folio.id,
      propertyId: folio.propertyId,
      reservationId: folio.reservationId,
      guestId: folio.guestId,
      folioNumber: folio.folioNumber,
      status: folio.status as FolioStatus,
      currency: folio.currency,
      balance: new Prisma.Decimal(folio.balance).toFixed(4),
      version: folio.version,
      createdAt: folio.createdAt.toISOString(),
      updatedAt: folio.updatedAt.toISOString(),
      createdBy: folio.createdBy,
      closedAt: folio.closedAt ? folio.closedAt.toISOString() : null,
      closedBy: folio.closedBy || null,
    };
  }

  public mapToFolioTransactionDto(tx: any): FolioTransactionDto {
    return {
      id: tx.id,
      propertyId: tx.propertyId,
      folioId: tx.folioId,
      transactionCode: tx.transactionCode,
      description: tx.description,
      amount: new Prisma.Decimal(tx.amount).toFixed(4),
      taxAmount: new Prisma.Decimal(tx.taxAmount).toFixed(4),
      reasonCode: tx.reasonCode || null,
      postedAt: tx.postedAt.toISOString(),
      postedBy: tx.postedBy,
    };
  }

  public mapToPaymentDto(payment: any): PaymentDto {
    return {
      id: payment.id,
      propertyId: payment.propertyId,
      folioId: payment.folioId,
      amount: new Prisma.Decimal(payment.amount).toFixed(4),
      currency: payment.currency,
      paymentMethod: payment.paymentMethod as PaymentMethod,
      referenceNumber: payment.referenceNumber || null,
      status: payment.status as PaymentStatus,
      processedAt: payment.processedAt.toISOString(),
      processedBy: payment.processedBy,
    };
  }
}
