package domain

import "errors"

type ErrorKind uint8

const (
	InvalidInput ErrorKind = iota
	Conflict
	NotFound
)

type Error struct {
	Kind    ErrorKind
	Message string
}

func (err *Error) Error() string         { return err.Message }
func Invalid(message string) error       { return &Error{Kind: InvalidInput, Message: message} }
func AlreadyExists(message string) error { return &Error{Kind: Conflict, Message: message} }

var ErrNotFound = errors.New("record not found")

func Missing(message string) error { return &Error{Kind: NotFound, Message: message} }
