import { Ticket } from '../models/Ticket.js';

class TicketService {
  // Создание билета (для админа)
  async createTicket(ticketData) {
    return await Ticket.create({
      title: ticketData.title,
      description: ticketData.description,
      image_url: ticketData.image_url,
      event_date: ticketData.event_date,
      event_location: ticketData.event_location,
      price: ticketData.price,
      ticket_number: ticketData.ticket_number || this.generateTicketNumber(),
      is_used: false
    });
  }

  // Получение всех билетов
  async getAllTickets() {
    return await Ticket.findAll();
  }

  // Получение билета по ID
  async getTicketById(ticketId) {
    return await Ticket.findByPk(ticketId);
  }

  // Обновление билета
  async updateTicket(ticketId, updateData) {
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) throw new Error('Билет не найден');
    
    return await ticket.update(updateData);
  }

  // Удаление билета
  async deleteTicket(ticketId) {
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) throw new Error('Билет не найден');
    
    await ticket.destroy();
    return true;
  }

  // Генерация номера билета
  generateTicketNumber() {
    return 'T-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  }
}

// Создаем экземпляр сервиса и экспортируем его
const ticketService = new TicketService();
export default ticketService;