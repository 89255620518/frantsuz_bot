import { Ticket } from '../models/Event.js';

class eventService {
  // Создание билета (для админа)
  async createTicket(ticketData) {
    return await Ticket.create({
      title: ticketData.title,
      description: ticketData.description,
      image_url: ticketData.image_url,
      event_date: ticketData.event_date,
      event_location: ticketData.event_location,
      price: ticketData.price,
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
const EventService = new eventService();
export default EventService;