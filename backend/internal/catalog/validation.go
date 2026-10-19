package catalog

import (
	"regexp"
	"strings"
	"unicode/utf8"

	"deadline-tracker/internal/domain"
)

var hexColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

func validateItem(c *domain.Catalog) error {
	c.Name = strings.TrimSpace(c.Name)
	if c.Section != "" && c.Section != "medznat" && c.Section != "onpoint" && c.Section != "medpoint" && c.Section != "special" {
		return domain.Invalid("Выберите раздел задач")
	}
	if c.Kind != "platform" && c.Kind != "specialty" && c.Kind != "status" {
		return domain.Invalid("Выберите тип справочника")
	}
	if c.Name == "" || utf8.RuneCountInString(c.Name) > 150 {
		return domain.Invalid("Название должно содержать от 1 до 150 символов")
	}
	if c.Color == "" {
		c.Color = "#aac4d6"
	}
	if !hexColor.MatchString(c.Color) {
		return domain.Invalid("Некорректный цвет")
	}
	if c.Position < 0 || c.Position > 1000000 {
		return domain.Invalid("Порядок должен быть от 0 до 1000000")
	}
	return nil
}
