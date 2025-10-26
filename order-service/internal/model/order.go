package model

import "time"

type Order struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	ProductId  uint      `json:"productId"`
	TotalPrice float64   `json:"totalPrice"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"createdAt"`
}

type CreateOrderRequest struct {
	ProductId uint `json:"productId"`
	Quantity  uint `json:"quantity"`
}

type ProductResponse struct {
	ID    uint    `json:"id"`
	Name  string  `json:"name"`
	Price float64 `json:"price"`
	Qty   uint    `json:"qty"`
}
