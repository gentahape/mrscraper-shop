package repository

import (
	"order-service/internal/model"

	"gorm.io/gorm"
)

type OrderRepository interface {
	CreateOrder(order *model.Order) error
	GetOrdersByProductID(productID string) ([]model.Order, error)
}

type orderRepository struct {
	db *gorm.DB
}

func NewOrderRepository(db *gorm.DB) OrderRepository {
	return &orderRepository{db}
}

func (r *orderRepository) CreateOrder(order *model.Order) error {
	tx := r.db.Begin()
	if tx.Error != nil {
		return tx.Error
	}

	if err := tx.Create(order).Error; err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit().Error
}

func (r *orderRepository) GetOrdersByProductID(productID string) ([]model.Order, error) {
	var orders []model.Order
	if err := r.db.Where("product_id = ?", productID).Order("orders.id desc").Find(&orders).Error; err != nil {
		return nil, err
	}
	return orders, nil
}
