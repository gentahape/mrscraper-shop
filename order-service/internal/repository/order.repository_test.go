package repository

import (
	"order-service/internal/model"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func setupMockDB(t *testing.T) (*gorm.DB, sqlmock.Sqlmock) {
	db, mock, err := sqlmock.New()
	assert.NoError(t, err)

	gormDB, err := gorm.Open(postgres.New(postgres.Config{
		Conn: db,
	}), &gorm.Config{})
	assert.NoError(t, err)

	return gormDB, mock
}

func TestCreateOrder_Success(t *testing.T) {
	db, mock := setupMockDB(t)
	repo := NewOrderRepository(db)

	order := &model.Order{
		ProductId:  1,
		TotalPrice: 1000,
		Status:     "SUCCESS",
		CreatedAt:  time.Now(),
	}

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "orders"`).
		WithArgs(order.ProductId, order.TotalPrice, order.Status, sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectCommit()

	err := repo.CreateOrder(order)
	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestCreateOrder_FailInsert(t *testing.T) {
	db, mock := setupMockDB(t)
	repo := NewOrderRepository(db)

	order := &model.Order{
		ProductId:  1,
		TotalPrice: 1000,
		Status:     "SUCCESS",
		CreatedAt:  time.Now(),
	}

	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "orders"`).
		WithArgs(order.ProductId, order.TotalPrice, order.Status, sqlmock.AnyArg()).
		WillReturnError(assert.AnError)
	mock.ExpectRollback()

	err := repo.CreateOrder(order)
	assert.Error(t, err)
	assert.Equal(t, assert.AnError, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGetOrdersByProductID_Success(t *testing.T) {
	db, mock := setupMockDB(t)
	repo := NewOrderRepository(db)

	rows := sqlmock.NewRows([]string{"id", "product_id", "total_price", "status", "created_at"}).
		AddRow(1, int64(1), 1000.0, "SUCCESS", time.Now())

	mock.ExpectQuery(`SELECT \* FROM "orders" WHERE product_id = \$1 ORDER BY orders.id desc`).
		WithArgs(int64(1)).
		WillReturnRows(rows)

	result, err := repo.GetOrdersByProductID("1")
	assert.NoError(t, err)
	assert.Len(t, result, 1)
	assert.Equal(t, int64(1), int64(result[0].ProductId))
	assert.Equal(t, "SUCCESS", result[0].Status)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGetOrdersByProductID_FailQuery(t *testing.T) {
	db, mock := setupMockDB(t)
	repo := NewOrderRepository(db)

	mock.ExpectQuery(`SELECT \* FROM "orders" WHERE product_id = \$1 ORDER BY orders.id desc`).
		WithArgs(int64(1)).
		WillReturnError(assert.AnError)

	result, err := repo.GetOrdersByProductID("1")
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.NoError(t, mock.ExpectationsWereMet())
}
