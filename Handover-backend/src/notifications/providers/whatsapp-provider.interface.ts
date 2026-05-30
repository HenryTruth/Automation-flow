export interface IWhatsappProvider {
  sendMessage(phone: string, templateName: string, variables: Record<string, string>): Promise<void>;
}

export const WHATSAPP_PROVIDER = Symbol('WHATSAPP_PROVIDER');
