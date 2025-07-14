import nodemailer from 'nodemailer';

// Настройки SMTP из вашего примера
const transporter = nodemailer.createTransport({
    host: 'server61.hosting.reg.ru',
    port: 465,
    secure: true, // SSL
    auth: {
        user: 'zakaz@dali-khinkali.ru',
        pass: '1234567Asd!'
    }
});

// Функция отправки email пользователю
export const sendUserTicketEmail = async (userEmail, ticketData) => {
    try {
        const mailOptions = {
            from: '"Клуб Француз" <zakaz@dali-khinkali.ru>',
            to: userEmail,
            subject: `Билет №${ticketData.number} на "${ticketData.event.title}"`,
            text: `
Уважаемый(ая) ${ticketData.customer.name},

Благодарим за покупку билета в клуб "Француз"!

Детали билета:
🎭 Мероприятие: ${ticketData.event.title}
📅 Дата: ${ticketData.event.date} в ${ticketData.event.time}
📍 Место: ${ticketData.event.location}
💰 Сумма: ${ticketData.price} руб.
🎫 Номер билета: ${ticketData.number}

Контактные данные:
👤 Имя: ${ticketData.customer.name}
📞 Телефон: ${ticketData.customer.phone}
📧 Email: ${ticketData.customer.email}

Ждем вас на мероприятии!

С уважением,
Команда клуба "Француз"
            `,
            html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2c3e50;">Уважаемый(ая) ${ticketData.customer.name},</h2>
    <p>Благодарим за покупку билета в клуб "Француз"!</p>
    
    <h3 style="color: #2c3e50;">Детали билета:</h3>
    <p>🎭 <strong>Мероприятие:</strong> ${ticketData.event.title}</p>
    <p>📅 <strong>Дата:</strong> ${ticketData.event.date} в ${ticketData.event.time}</p>
    <p>📍 <strong>Место:</strong> ${ticketData.event.location}</p>
    <p>💰 <strong>Сумма:</strong> ${ticketData.price} руб.</p>
    <p>🎫 <strong>Номер билета:</strong> ${ticketData.number}</p>
    
    <h3 style="color: #2c3e50;">Контактные данные:</h3>
    <p>👤 <strong>Имя:</strong> ${ticketData.customer.name}</p>
    <p>📞 <strong>Телефон:</strong> ${ticketData.customer.phone}</p>
    <p>📧 <strong>Email:</strong> ${ticketData.customer.email}</p>
    
    <p>Ждем вас на мероприятии!</p>
    
    <p style="margin-top: 30px;">С уважением,<br>Команда клуба "Француз"</p>
</div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log('Email пользователю отправлен');
        return true;
    } catch (error) {
        console.error('Ошибка отправки email пользователю:', error);
        return false;
    }
};

// Функция отправки уведомления администратору
export const sendAdminNotification = async (adminEmail, ticketData) => {
    try {
        const mailOptions = {
            from: '"Клуб Француз" <zakaz@dali-khinkali.ru>',
            to: adminEmail,
            subject: `Новая продажа билета №${ticketData.number}`,
            text: `
Новая продажа билета:

Детали билета:
🎭 Мероприятие: ${ticketData.event.title}
📅 Дата: ${ticketData.event.date} в ${ticketData.event.time}
💰 Сумма: ${ticketData.price} руб.
🎫 Номер билета: ${ticketData.number}
📝 Номер счета: ${ticketData.invoiceId}

Данные клиента:
👤 Имя: ${ticketData.customer.name}
📞 Телефон: ${ticketData.customer.phone}
📧 Email: ${ticketData.customer.email}
            `,
            html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2c3e50;">Новая продажа билета</h2>
    
    <h3 style="color: #2c3e50;">Детали билета:</h3>
    <p>🎭 <strong>Мероприятие:</strong> ${ticketData.event.title}</p>
    <p>📅 <strong>Дата:</strong> ${ticketData.event.date} в ${ticketData.event.time}</p>
    <p>💰 <strong>Сумма:</strong> ${ticketData.price} руб.</p>
    <p>🎫 <strong>Номер билета:</strong> ${ticketData.number}</p>
    <p>📝 <strong>Номер счета:</strong> ${ticketData.invoiceId}</p>
    
    <h3 style="color: #2c3e50;">Данные клиента:</h3>
    <p>👤 <strong>Имя:</strong> ${ticketData.customer.name}</p>
    <p>📞 <strong>Телефон:</strong> ${ticketData.customer.phone}</p>
    <p>📧 <strong>Email:</strong> ${ticketData.customer.email}</p>
</div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log('Email администратору отправлен');
        return true;
    } catch (error) {
        console.error('Ошибка отправки email администратору:', error);
        return false;
    }
};