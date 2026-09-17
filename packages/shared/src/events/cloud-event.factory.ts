import { generateUuidV7 } from '../uuid/uuidv7';

export interface CloudEvent<T = any> {
  id: string;
  specversion: string;
  type: string;
  source: string;
  subject?: string;
  datacontenttype: string;
  time: string;
  data: T;
  tenantid?: string;
  propertyid?: string;
  correlationid?: string;
  causationid?: string;
}

export interface CreateCloudEventParams<T> {
  type: string;
  source: string;
  subject?: string;
  data: T;
  tenantId?: string;
  propertyId?: string;
  correlationId?: string;
  causationId?: string;
}

export function createCloudEvent<T>(params: CreateCloudEventParams<T>): CloudEvent<T> {
  return {
    id: generateUuidV7(),
    specversion: '1.0',
    type: params.type,
    source: params.source,
    subject: params.subject,
    datacontenttype: 'application/json',
    time: new Date().toISOString(),
    data: params.data,
    tenantid: params.tenantId,
    propertyid: params.propertyId,
    correlationid: params.correlationId,
    causationid: params.causationId,
  };
}
