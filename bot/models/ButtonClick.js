import { Model, DataTypes } from "sequelize";

class ButtonClick extends Model {
    static async incrementClick(buttonId) {
        if (!buttonId) {
            throw new Error('Invalid buttonId: buttonId is required');
        }

        const transaction = await this.sequelize.transaction();

        try {
            const [buttonClick, created] = await this.findOrCreate({
                where: { button_id: buttonId },
                defaults: {
                    count: 1
                },
                transaction
            });

            if (!created) {
                await buttonClick.increment('count', { by: 1, transaction });
            }

            await transaction.commit();
            return buttonClick;
        } catch (error) {
            await transaction.rollback();
            console.error('Error in incrementClick:', error);
            throw error;
        }
    }
}

const initButtonClick = (sequelize) => {
    ButtonClick.init(
        {
            button_id: {
                type: DataTypes.STRING,
                allowNull: false,
                primaryKey: true,
            },
            count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            }
        },
        {
            sequelize,
            modelName: "ButtonClick",
            tableName: "button_clicks",
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            underscored: true,
            indexes: [
                {
                    unique: true,
                    fields: ['button_id'],
                    name: 'button_clicks_button_id_unique'
                },
                {
                    fields: ['count'],
                    name: 'button_clicks_count_index'
                }
            ],
        }
    );

    return ButtonClick;
};

export { ButtonClick, initButtonClick };