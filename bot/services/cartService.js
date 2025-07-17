class CartService {
    constructor() {
        this.carts = {}; // { chatId: { items: [], userData: {} } }
    }

    // Добавление билета в корзину
    addToCart(chatId, ticketId, quantity = 1) {
        if (!this.carts[chatId]) {
            this.carts[chatId] = { items: [], userData: {} };
        }

        const existingItem = this.carts[chatId].items.find(item => item.ticketId === ticketId);
        
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            this.carts[chatId].items.push({ ticketId, quantity });
        }
    }

    // Удаление билета из корзины
    removeFromCart(chatId, ticketId) {
        if (!this.carts[chatId]) return false;
        
        this.carts[chatId].items = this.carts[chatId].items.filter(item => item.ticketId !== ticketId);
        return true;
    }

    // Обновление данных пользователя
    updateUserData(chatId, userData) {
        if (!this.carts[chatId]) {
            this.carts[chatId] = { items: [], userData: {} };
        }
        
        this.carts[chatId].userData = { ...this.carts[chatId].userData, ...userData };
    }

    // Получение содержимого корзины
    getCart(chatId) {
        return this.carts[chatId] || { items: [], userData: {} };
    }

    // Очистка корзины
    clearCart(chatId) {
        if (this.carts[chatId]) {
            delete this.carts[chatId];
        }
    }

    // Подсчет общей суммы
    async calculateTotal(chatId, ticketService) {
        const cart = this.getCart(chatId);
        let total = 0;
        
        for (const item of cart.items) {
            const ticket = await ticketService.getTicketById(item.ticketId);
            if (ticket) {
                total += ticket.price * item.quantity;
            }
        }
        
        return total;
    }
}

// Экспортируем singleton экземпляр
export const cartService = new CartService();