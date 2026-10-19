package auth

import (
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct{ DB *pgxpool.Pool }
