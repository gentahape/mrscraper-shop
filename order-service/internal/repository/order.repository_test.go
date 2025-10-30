package repository

import (
	"errors"
	"order-service/internal/model"
	"regexp"
	"testing"
	"time"

	"github.com/pashagolub/pgxmock/v3"
	"github.com/stretchr/testify/assert"
)

func TestCreateOrder_Success(t *testing.T) {
	mockDB, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("failed to create mock pool: %v", err)
	}
	defer mockDB.Close()

	repo := &orderRepository{db: mockDB}

	testOrder := &model.Order{
		ProductId:  1,
		TotalPrice: 100.0,
		Status:     "PENDING",
		CreatedAt:  time.Now(),
	}

	mockDB.ExpectExec(regexp.QuoteMeta(`INSERT INTO orders (product_id, total_price, status, created_at) VALUES ($1, $2, $3, $4)`)).
		WithArgs(testOrder.ProductId, testOrder.TotalPrice, testOrder.Status, testOrder.CreatedAt).
		WillReturnResult(pgxmock.NewResult("INSERT", 1))

	err = repo.CreateOrder(testOrder)

	assert.NoError(t, err)

	err = mockDB.ExpectationsWereMet()
	assert.NoError(t, err, "expectations were not met")
}

func TestCreateOrder_DBError(t *testing.T) {
	mockDB, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("failed to create mock pool: %v", err)
	}
	defer mockDB.Close()

	repo := &orderRepository{db: mockDB}

	testOrder := &model.Order{}
	dbError := errors.New("database connection error")

	mockDB.ExpectExec(regexp.QuoteMeta(`INSERT INTO orders`)).
		WithArgs(testOrder.ProductId, testOrder.TotalPrice, testOrder.Status, testOrder.CreatedAt).
		WillReturnError(dbError)

	err = repo.CreateOrder(testOrder)

	assert.Error(t, err)
	assert.Equal(t, dbError, err)

	err = mockDB.ExpectationsWereMet()
	assert.NoError(t, err, "expectations were not met")
}

func TestGetOrdersByProductID_Success(t *testing.T) {
	mockDB, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("failed to create mock pool: %v", err)
	}
	defer mockDB.Close()

	repo := &orderRepository{db: mockDB}

	productID := "1"
	now := time.Now()

	mockRows := pgxmock.NewRows([]string{"id", "product_id", "total_price", "status", "created_at"}).
		AddRow(uint(2), uint(1), 200.0, "SUCCESS", now.Add(-time.Hour)).
		AddRow(uint(1), uint(1), 100.0, "PENDING", now)

	expectedQuery := regexp.QuoteMeta(`SELECT id, product_id, total_price, status, created_at FROM orders WHERE product_id = $1 ORDER BY id DESC`)
	mockDB.ExpectQuery(expectedQuery).
		WithArgs(productID).
		WillReturnRows(mockRows)

	orders, err := repo.GetOrdersByProductID(productID)

	assert.NoError(t, err)
	assert.NotNil(t, orders)
	assert.Len(t, orders, 2)
	assert.Equal(t, uint(2), orders[0].ID)
	assert.Equal(t, uint(1), orders[1].ID)
	assert.Equal(t, uint(1), orders[0].ProductId)
	assert.Equal(t, uint(1), orders[1].ProductId)

	err = mockDB.ExpectationsWereMet()
	assert.NoError(t, err, "expectations were not met")
}

func TestGetOrdersByProductID_DBError(t *testing.T) {
	mockDB, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("failed to create mock pool: %v", err)
	}
	defer mockDB.Close()

	repo := &orderRepository{db: mockDB}
	productID := "1"
	dbError := errors.New("query execution failed")

	expectedQuery := regexp.QuoteMeta(`SELECT id, product_id, total_price, status, created_at FROM orders`)
	mockDB.ExpectQuery(expectedQuery).
		WithArgs(productID).
		WillReturnError(dbError)

	orders, err := repo.GetOrdersByProductID(productID)

	assert.Error(t, err)
	assert.Nil(t, orders)
	assert.Equal(t, dbError, err)

	err = mockDB.ExpectationsWereMet()
	assert.NoError(t, err, "expectations were not met")
}

func TestGetOrdersByProductID_ScanError(t *testing.T) {
	mockDB, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("failed to create mock pool: %v", err)
	}
	defer mockDB.Close()

	repo := &orderRepository{db: mockDB}
	productID := "1"

	mockRows := pgxmock.NewRows([]string{"id", "product_id", "total_price", "status", "created_at"}).
		AddRow("not-number", uint(1), 100.0, "PENDING", time.Now())

	expectedQuery := regexp.QuoteMeta(`SELECT id, product_id, total_price, status, created_at FROM orders`)
	mockDB.ExpectQuery(expectedQuery).
		WithArgs(productID).
		WillReturnRows(mockRows)

	orders, err := repo.GetOrdersByProductID(productID)

	assert.Error(t, err)
	assert.Nil(t, orders)

	err = mockDB.ExpectationsWereMet()
	assert.NoError(t, err, "expectations were not met")
}
