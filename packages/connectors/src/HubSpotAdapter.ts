import { Client } from '@hubspot/api-client';
import { 
  CRMAdapter, 
  CustomerProfile, 
  OpenTicket
} from '../../shared/src/index.js';

/**
 * HubSpot CRM Adapter
 * - Authenticates via Private App Access Token
 * - Handles Contact Upsert, Ticket Creation, and Deal Generation for Sales Pivots
 * - Optimized for async execution to protect the &lt;2s response path
 */
export class HubSpotAdapter implements CRMAdapter {
  private client: Client;

  constructor(accessToken: string) {
    this.client = new Client({ accessToken });
  }

  /**
   * Upsert a contact in HubSpot based on the internal CustomerProfile
   */
  async upsertContact(profile: CustomerProfile): Promise<string> {
    const properties: Record<string, string> = {
      firstname: profile.id, // Using internal ID as a placeholder for name in MVP
    };

    if (profile.primaryEmail) properties.email = profile.primaryEmail;
    if (profile.primaryPhone) properties.phone = profile.primaryPhone;
    if (profile.locale) properties.hs_language = profile.locale;
    if (profile.timezone) properties.hs_timezone = profile.timezone;

    try {
      // Identity resolution: when email exists, search then upsert.
      if (profile.primaryEmail) {
        const searchResponse = await this.client.crm.contacts.searchApi.doSearch({
          filterGroups: [{
            filters: [{ propertyName: 'email', operator: 'EQ' as any, value: profile.primaryEmail }]
          }],
          limit: 1,
          properties: ['id'],
        });

        if (searchResponse.total > 0) {
          const contactId = searchResponse.results[0].id;
          await this.client.crm.contacts.basicApi.update(contactId, { properties });
          return contactId;
        }
      }

      const createResponse = await this.client.crm.contacts.basicApi.create({ properties });
      return createResponse.id;
    } catch (error) {
      console.error('[HubSpot] UpsertContact failed:', error);
      throw new Error('CRM_SYNC_FAILED');
    }
  }

  /**
   * Create a support ticket linked to a customer
   */
  async createTicket(ticket: OpenTicket): Promise<string> {
    const properties = {
      hs_pipeline: 'default',
      hs_pipeline_stage: '1', // New
      hs_ticket_priority: ticket.priority.toUpperCase(),
      subject: `AI Support: ${ticket.intent || 'General Inquiry'}`,
      content: `Ticket created by AI Agent. Internal ID: ${ticket.id}`,
    };

    try {
      const response = await this.client.crm.tickets.basicApi.create({ properties });
      // In production, you would link the ticket to the contact ID here
      return response.id;
    } catch (error) {
      console.error('[HubSpot] CreateTicket failed:', error);
      throw new Error('CRM_TICKET_FAILED');
    }
  }

  /**
   * Log an engagement (note) on the customer's timeline
   */
  async logEngagement(customerId: string, activity: string): Promise<void> {
    // Note: This requires the 'crm.objects.notes.write' scope
    try {
      await this.client.crm.objects.notes.basicApi.create({
        properties: {
          hs_note_body: activity,
          hs_timestamp: new Date().toISOString(),
        }
      });
    } catch (error) {
      console.error('[HubSpot] LogEngagement failed:', error);
    }
  }

  /**
   * Create a Deal when a Sales Pivot is successful
   */
  async createDeal(customerId: string, dealStage: string = 'appointmentscheduled'): Promise<string> {
    const properties = {
      dealname: `AI Qualified Lead: ${customerId}`,
      dealstage: dealStage,
      pipeline: 'default',
      amount: '0', // Set a default value or calculate based on intent
    };

    try {
      const response = await this.client.crm.deals.basicApi.create({ properties });
      return response.id;
    } catch (error) {
      console.error('[HubSpot] CreateDeal failed:', error);
      throw new Error('CRM_DEAL_FAILED');
    }
  }
}
